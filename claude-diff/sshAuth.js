// Build ssh2 Client.connect options for the remote-aware diff/plan viewer.
//
// Authentication precedence honors the user's own `ssh` cmdline, then
// `~/.ssh/config` (resolved via `ssh -G`), then the running ssh-agent, and
// finally the WebDAV tunnel's configured key (only when connecting to the
// same host the tunnel uses).
//
//   1. sshCtx.identityFile (from `-i`)                                [explicit]
//   2. IdentityFile entries from `~/.ssh/config` for this host         [user config]
//   3. process.env.SSH_AUTH_SOCK (ssh-agent)                           [always attached when available]
//   4. webdavTunnelCfg.privateKeyPath (iff sshCtx.host matches)        [reuse]
//
// `ssh -G` also feeds back resolved Hostname/User/Port so Host aliases in
// `~/.ssh/config` (e.g. `ssh work-box`) work.
//
// If no viable method, `opts.authError` carries an actionable hint. The
// `formatAuthFailure` helper likewise turns ssh2's opaque "All configured
// authentication methods failed" into concrete next steps.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function tryReadKey(filePath) {
  try { return fs.readFileSync(expandHome(filePath)); }
  catch (err) { return { error: err }; }
}

// Heuristic: peek at key bytes to see if it needs a passphrase. Used only to
// craft a better error message — we don't refuse encrypted keys here. ssh2
// itself will fail the load with a specific error when no passphrase is set.
function keyLooksEncrypted(buf) {
  if (!Buffer.isBuffer(buf)) return false;
  const head = buf.slice(0, 4096).toString('utf8');
  if (/Proc-Type:\s*4,ENCRYPTED/i.test(head)) return true;
  if (/-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(head)) return true;
  // OpenSSH-format keys encode the cipher name after the magic header.
  // "aes256-ctr" / "aes256-cbc" etc. → encrypted; "none" → unencrypted.
  if (head.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----')) {
    const body = head.replace(/-----BEGIN OPENSSH PRIVATE KEY-----/, '')
                     .replace(/-----END.*$/s, '')
                     .replace(/\s+/g, '');
    try {
      const bin = Buffer.from(body, 'base64');
      // magic "openssh-key-v1\0" (15 bytes) then uint32 cipherName length + name.
      if (bin.length > 19 && bin.slice(0, 15).toString('ascii') === 'openssh-key-v1\0') {
        const nameLen = bin.readUInt32BE(15);
        if (nameLen > 0 && nameLen < 64 && 19 + nameLen <= bin.length) {
          const cipher = bin.slice(19, 19 + nameLen).toString('ascii');
          return cipher !== 'none';
        }
      }
    } catch { /* fall through */ }
  }
  return false;
}

// Call `ssh -G [user@]host [-p port]` to ask OpenSSH what it would do for
// this target — resolves HostName/User/Port/IdentityFile including aliases,
// Match blocks, and Include directives. 2s hard timeout. Returns null on
// any failure (caller falls back to bare defaults).
function resolveSshConfig({ host, user, port }) {
  if (!host) return null;
  const args = ['-G'];
  if (port) { args.push('-p', String(port)); }
  args.push(user ? `${user}@${host}` : host);
  let out;
  try {
    out = execFileSync('ssh', args, {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  const identityFiles = [];
  let hostname = null, resolvedUser = null, resolvedPort = null;
  for (const line of out.split('\n')) {
    const m = /^(\S+)\s+(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'identityfile') identityFiles.push(expandHome(val));
    else if (key === 'hostname' && !hostname) hostname = val;
    else if (key === 'user' && !resolvedUser) resolvedUser = val;
    else if (key === 'port' && !resolvedPort) {
      const n = parseInt(val, 10);
      if (Number.isFinite(n) && n > 0) resolvedPort = n;
    }
  }
  return { hostname, user: resolvedUser, port: resolvedPort, identityFiles };
}

// sshCtx:    { host, user, port, identityFile }  (from sshDetect)
// options:   { webdavTunnelCfg, currentUser }    (tunnelCfg is settings.webdav.sshTunnel)
//
// Returns an object suitable to pass to `new Client().connect(opts)`, with
// extra fields:
//   - usedAuth:       'identityFile' | 'sshConfigKey' | 'agent' | 'tunnelKey' | 'none'
//   - authError:      string | null   (human-readable reason nothing worked)
//   - authAttempts:   array describing every method we tried (for error UX)
//   - target:         { host, user, port }  (original, for error UX)
function buildConnectOpts(sshCtx, { webdavTunnelCfg, currentUser } = {}) {
  if (!sshCtx || !sshCtx.host) {
    return { authError: 'No SSH host in terminal context.' };
  }

  // Ask OpenSSH what it would do — picks up Host aliases, per-host
  // IdentityFile entries, Match blocks, and Include directives.
  const cfg = resolveSshConfig({ host: sshCtx.host, user: sshCtx.user, port: sshCtx.port });

  const host = (cfg && cfg.hostname) || sshCtx.host;
  const username = sshCtx.user || (cfg && cfg.user) || currentUser || os.userInfo().username;
  const port = Number(sshCtx.port) || (cfg && cfg.port) || 22;

  const opts = {
    host,
    port,
    username,
    readyTimeout: 15_000,
    keepaliveInterval: 30_000,
    keepaliveCountMax: 3,
  };

  const agentSock = process.env.SSH_AUTH_SOCK;
  const attempts = [];
  let usedAuth = 'none';
  let keySet = false;
  let passphraseSuspected = false;

  const tryKey = (filePath, label) => {
    if (keySet) return;
    const k = tryReadKey(filePath);
    if (Buffer.isBuffer(k)) {
      opts.privateKey = k;
      keySet = true;
      usedAuth = label;
      if (keyLooksEncrypted(k)) passphraseSuspected = true;
      attempts.push({ method: label, path: expandHome(filePath), ok: true });
    } else {
      attempts.push({
        method: label,
        path: expandHome(filePath),
        ok: false,
        error: (k.error && k.error.code) || (k.error && k.error.message) || 'unreadable',
      });
    }
  };

  // 1. Explicit `-i` from the user's ssh cmdline — wins over everything.
  if (sshCtx.identityFile) tryKey(sshCtx.identityFile, 'identityFile');

  // 2. IdentityFile entries from `~/.ssh/config` (ssh -G output). Try each
  //    in order and keep the first that loads. Silently skip files that
  //    don't exist — `ssh -G` always emits default paths like ~/.ssh/id_rsa
  //    whether or not the user actually has that key.
  if (!keySet && cfg && Array.isArray(cfg.identityFiles)) {
    for (const f of cfg.identityFiles) {
      if (keySet) break;
      try {
        if (!fs.existsSync(expandHome(f))) continue;
      } catch { continue; }
      tryKey(f, 'sshConfigKey');
    }
  }

  // 3. ssh-agent — always attach when available. ssh2 tries it alongside
  //    any explicit privateKey, so this also covers passphrase-protected
  //    keys the user has already loaded via `ssh-add`.
  if (agentSock) {
    opts.agent = agentSock;
    if (usedAuth === 'none') usedAuth = 'agent';
    attempts.push({ method: 'agent', path: agentSock, ok: true });
  }

  // 4. WebDAV tunnel key — reuse only if host matches.
  if (
    !keySet
    && webdavTunnelCfg
    && webdavTunnelCfg.privateKeyPath
    && webdavTunnelCfg.host === sshCtx.host
  ) {
    const k = tryReadKey(webdavTunnelCfg.privateKeyPath);
    if (Buffer.isBuffer(k)) {
      opts.privateKey = k;
      if (webdavTunnelCfg.passphrase) opts.passphrase = webdavTunnelCfg.passphrase;
      if (keyLooksEncrypted(k) && !webdavTunnelCfg.passphrase) passphraseSuspected = true;
      keySet = true;
      if (usedAuth === 'none' || usedAuth === 'agent') usedAuth = 'tunnelKey';
      attempts.push({ method: 'tunnelKey', path: expandHome(webdavTunnelCfg.privateKeyPath), ok: true });
    } else {
      attempts.push({
        method: 'tunnelKey',
        path: expandHome(webdavTunnelCfg.privateKeyPath),
        ok: false,
        error: (k.error && k.error.code) || 'unreadable',
      });
    }
  }

  opts.usedAuth = usedAuth;
  opts.authAttempts = attempts;
  opts.target = { host: sshCtx.host, user: username, port };
  opts.passphraseSuspected = passphraseSuspected;

  if (usedAuth === 'none') {
    opts.authError = _noMethodMessage(opts.target, attempts);
  }
  return opts;
}

function _noMethodMessage(target, attempts) {
  const t = `${target.user}@${target.host}${target.port !== 22 ? ':' + target.port : ''}`;
  const failed = attempts.filter((a) => !a.ok);
  const lines = [
    `No SSH authentication available for ${t}.`,
    'Tried:',
  ];
  if (failed.length) {
    for (const a of failed) lines.push(`  • ${a.method} (${a.path}) — ${a.error}`);
  } else {
    lines.push('  • nothing (no -i in your ssh cmdline, no readable key in ~/.ssh/config, no ssh-agent)');
  }
  lines.push('');
  lines.push('To fix, pick one:');
  lines.push(`  1. Add a key to ssh-agent: ssh-add ~/.ssh/id_ed25519`);
  if (process.platform === 'darwin') {
    lines.push('     (macOS Keychain: ssh-add --apple-use-keychain ~/.ssh/id_ed25519)');
  }
  lines.push('  2. Pass -i <keypath> when you run ssh in this terminal tab.');
  lines.push(`  3. Add an IdentityFile entry for ${target.host} to ~/.ssh/config.`);
  return lines.join('\n');
}

// Translate ssh2's raw connect errors into something actionable. Called by
// the remote pop-up plumbing when `openRemote` rejects.
function formatAuthFailure(err, connectOpts) {
  const raw = (err && err.message) || String(err);
  const isAuthReject = /All configured authentication methods failed/i.test(raw);
  if (!isAuthReject) return raw;

  const target = connectOpts && connectOpts.target;
  const attempts = (connectOpts && connectOpts.authAttempts) || [];
  const t = target
    ? `${target.user}@${target.host}${target.port !== 22 ? ':' + target.port : ''}`
    : 'remote host';
  const tried = attempts.filter((a) => a.ok).map((a) => {
    if (a.method === 'agent') return 'ssh-agent';
    if (a.method === 'identityFile') return `-i ${a.path}`;
    if (a.method === 'sshConfigKey') return `~/.ssh/config IdentityFile ${a.path}`;
    if (a.method === 'tunnelKey') return `WebDAV tunnel key ${a.path}`;
    return a.method;
  });

  const lines = [
    `${t} rejected all authentication methods${tried.length ? ' (' + tried.join(', ') + ')' : ''}.`,
    '',
    'Likely causes:',
  ];
  if (connectOpts && connectOpts.passphraseSuspected) {
    lines.push('  • Your key is passphrase-protected but the agent doesn’t have it loaded.');
    lines.push('    Run: ssh-add ~/.ssh/id_ed25519');
    if (process.platform === 'darwin') {
      lines.push('    (macOS Keychain: ssh-add --apple-use-keychain ~/.ssh/id_ed25519)');
    }
  } else {
    lines.push('  • The key we sent isn’t authorized on the remote — check ~/.ssh/authorized_keys there.');
    lines.push('  • Your ssh-agent is empty or has stale keys — run `ssh-add -l` to check, then `ssh-add <keypath>`.');
    lines.push(`  • Wrong username — confirm the remote user for ${target && target.host ? target.host : 'this host'}.`);
  }
  lines.push('');
  lines.push('Tip: run the same `ssh` command in a shell first. If that works, MAD will too.');
  return lines.join('\n');
}

// A short stable key for caching ssh2 Clients across identical targets.
function connectKey(opts) {
  if (!opts || !opts.host) return null;
  return `${opts.username || ''}@${opts.host}:${opts.port || 22}`;
}

module.exports = {
  buildConnectOpts,
  connectKey,
  expandHome,
  resolveSshConfig,
  formatAuthFailure,
};

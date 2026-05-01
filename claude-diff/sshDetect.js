// Per-terminal SSH detection.
//
// Given a PTY root pid, walk its descendant process tree to find an active
// `ssh` subprocess. If one is found, parse its cmdline to extract the host,
// user, port, and identity-file the user actually typed. This is how MAD's
// diff / plan pop-ups learn which host the terminal is connected to —
// entirely independent of any configured WebDAV tunnel.
//
// Linux uses `/proc`; macOS uses `ps` (via `procTree`). On Windows there is
// no equivalent, so `detectSshContext` returns `{ isSsh: false }` and the
// viewer falls back to local-only.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const procTree = require('./procTree');

const PROC = '/proc';

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

const readChildPids = procTree.readChildPids;
const readComm = procTree.readComm;
const readCmdline = procTree.readCmdline;

// ssh option parser. Follows OpenSSH argv grammar closely enough for our
// purposes: we need host, user, port, and identity file.
//
// Options that take an argument (either attached or as the next token):
//   -b -c -D -E -e -F -I -i -J -L -l -m -O -o -p -Q -R -S -W -w
// Boolean flags we ignore: -4 -6 -A -a -C -f -G -g -K -k -M -N -n -q -s -T -t
//                          -V -v -X -x -Y -y
function parseSshArgv(argv) {
  const WITH_ARG = new Set(['b','c','D','E','e','F','I','i','J','L','l','m','O','o','p','Q','R','S','W','w']);
  const result = { host: null, user: null, port: null, identityFile: null, remoteCommand: null };
  let i = 1;
  const positional = [];
  let remoteCmdStart = -1;

  while (i < argv.length) {
    const a = argv[i];
    if (a === '--') { remoteCmdStart = i + 1; break; }
    if (a === '-' || !a.startsWith('-')) { positional.push(a); i++; continue; }
    // Short option(s). They may be stacked (e.g. `-vAC`). The arg-taking
    // option can either consume the remainder of the same token or the next.
    let j = 1;
    let consumedNext = false;
    while (j < a.length) {
      const ch = a[j];
      if (WITH_ARG.has(ch)) {
        let argVal;
        if (j + 1 < a.length) { argVal = a.slice(j + 1); j = a.length; }
        else { argVal = argv[i + 1]; consumedNext = true; j++; }
        if (ch === 'p') {
          const n = parseInt(argVal, 10);
          if (Number.isFinite(n) && n > 0) result.port = n;
        } else if (ch === 'i') {
          result.identityFile = expandHome(argVal);
        } else if (ch === 'l') {
          result.user = argVal;
        } else if (ch === 'o') {
          // -o User=foo / -o Port=22 / -o IdentityFile=...
          const m = /^([A-Za-z]+)\s*=\s*(.+)$/.exec(String(argVal || ''));
          if (m) {
            const key = m[1].toLowerCase();
            const val = m[2].trim();
            if (key === 'user' && !result.user) result.user = val;
            else if (key === 'port' && !result.port) {
              const n = parseInt(val, 10);
              if (Number.isFinite(n) && n > 0) result.port = n;
            } else if (key === 'identityfile' && !result.identityFile) {
              result.identityFile = expandHome(val);
            }
          }
        }
      } else {
        // Boolean flag; keep scanning the stack.
        j++;
      }
    }
    i += consumedNext ? 2 : 1;
  }

  // First positional is host (possibly user@host). Anything after that (or
  // after `--`) is the remote command — we don't need it.
  if (positional.length) {
    const first = positional[0];
    const at = first.indexOf('@');
    if (at > 0) {
      if (!result.user) result.user = first.slice(0, at);
      result.host = first.slice(at + 1);
    } else {
      result.host = first;
    }
    if (positional.length > 1) result.remoteCommand = positional.slice(1).join(' ');
  }
  if (remoteCmdStart > 0 && remoteCmdStart < argv.length) {
    const rest = argv.slice(remoteCmdStart).join(' ');
    result.remoteCommand = result.remoteCommand ? result.remoteCommand + ' ' + rest : rest;
  }

  return result;
}

// BFS the process tree rooted at `rootPid`, up to `maxDepth`. The first
// descendant whose comm is `ssh` wins. Depth kept small — the shell → ssh
// chain is usually 1-2 hops.
function findSshDescendant(rootPid, maxDepth = 6) {
  const visited = new Set();
  const queue = [{ pid: rootPid, depth: 0 }];
  while (queue.length) {
    const { pid, depth } = queue.shift();
    if (visited.has(pid)) continue;
    visited.add(pid);
    if (depth > 0) {
      const comm = readComm(pid);
      if (comm === 'ssh') return pid;
    }
    if (depth >= maxDepth) continue;
    for (const child of readChildPids(pid)) queue.push({ pid: child, depth: depth + 1 });
  }
  return null;
}

// Return the decimal source port of the one ESTABLISHED outbound TCP
// connection owned by `sshPid`, or null. This ties THIS tab's local ssh
// client to its peer sshd on the remote — the remote probe script matches on
// this port to disambiguate among multiple sessions for the same user.
function readSshSourcePort(sshPid) {
  if (!Number.isInteger(sshPid) || sshPid <= 0) return null;
  if (process.platform === 'darwin') return _readSshSourcePortMac(sshPid);
  if (process.platform !== 'linux') return null;
  const fdDir = `${PROC}/${sshPid}/fd`;
  const socketInodes = new Set();
  let entries;
  try { entries = fs.readdirSync(fdDir); } catch { return null; }
  for (const e of entries) {
    let target;
    try { target = fs.readlinkSync(`${fdDir}/${e}`); } catch { continue; }
    const m = /^socket:\[(\d+)\]$/.exec(target);
    if (m) socketInodes.add(m[1]);
  }
  if (!socketInodes.size) return null;
  for (const tcpPath of [`${PROC}/net/tcp`, `${PROC}/net/tcp6`]) {
    let raw;
    try { raw = fs.readFileSync(tcpPath, 'utf8'); } catch { continue; }
    const lines = raw.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].trim().split(/\s+/);
      if (cols.length < 10) continue;
      // cols: 0=sl 1=local_address 2=rem_address 3=st 4=tx:rx 5=tr:tm 6=retr 7=uid 8=timeout 9=inode
      if (cols[3] !== '01') continue; // TCP_ESTABLISHED
      if (!socketInodes.has(cols[9])) continue;
      const localPortHex = cols[1].split(':')[1];
      const port = parseInt(localPortHex, 16);
      if (Number.isFinite(port) && port > 0) return port;
    }
  }
  return null;
}

// macOS equivalent: lsof reports each ssh-owned socket as a line of the form
//   nLOCAL:LPORT->REMOTE:RPORT     (IPv4)
//   n[::1]:LPORT->[::2]:RPORT       (IPv6)
// We want the first established (has `->`) outbound TCP connection's LPORT.
function _readSshSourcePortMac(sshPid) {
  let out;
  try {
    out = execFileSync('/usr/sbin/lsof', [
      '-p', String(sshPid),
      '-an',
      '-iTCP',
      '-sTCP:ESTABLISHED',
      '-P', '-n',
      '-Fn',
    ], {
      encoding: 'utf8',
      timeout: 500,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  for (const rawLine of out.split('\n')) {
    if (!rawLine.startsWith('n')) continue;
    const name = rawLine.slice(1);
    const arrow = name.indexOf('->');
    if (arrow < 0) continue;
    const local = name.slice(0, arrow);
    // Strip optional [ipv6] wrapper, then take the port after the last colon.
    const colon = local.lastIndexOf(':');
    if (colon < 0) continue;
    const portStr = local.slice(colon + 1);
    const port = parseInt(portStr, 10);
    if (Number.isFinite(port) && port > 0) return port;
  }
  return null;
}

function detectSshContext(rootPid) {
  if (!procTree.isSupported() || !Number.isInteger(rootPid) || rootPid <= 0) {
    return { isSsh: false };
  }
  const sshPid = findSshDescendant(rootPid);
  if (!sshPid) return { isSsh: false };
  const argv = readCmdline(sshPid);
  if (!argv || argv.length === 0) return { isSsh: false };
  const parsed = parseSshArgv(argv);
  if (!parsed.host) return { isSsh: false };
  return {
    isSsh: true,
    pid: sshPid,
    host: parsed.host,
    user: parsed.user,          // may be null; caller resolves via ssh config
    port: parsed.port,          // may be null; defaults to 22
    identityFile: parsed.identityFile,  // may be null
    argv,
  };
}

module.exports = {
  detectSshContext,
  parseSshArgv,   // exported for tests
  findSshDescendant,
  readSshSourcePort,
  expandHome,
};

// Remote reader for Claude Code session transcripts and plan files, over
// SSH/SFTP. Mirrors the surface of localSource.js + planSource.js but reads
// from `$REMOTE_HOME/.claude/projects/` and `$REMOTE_HOME/.claude/plans/` on
// a remote host via the vendored ssh2 library.
//
// Contract highlights:
//   - openRemote(opts)      connects; returns a handle with exec/sftp/close
//   - listRemoteSessions    SFTP readdir + stat + small head-read for preview
//   - listRemotePlans       SFTP readdir + head-read for heading/paragraph
//   - readRemoteFile        SFTP full read
//   - watchRemoteFile       stat-poll (2 s) + incremental read of appended bytes
//
// The caller owns client lifecycle; nothing in here auto-closes. A separate
// idle-TTL cache lives in main.js.

'use strict';

const { Client: SshClient } = require('../vendors/ssh2');
const { parseLineBuffer, safeParseLine, extractSessionPreview, EDIT_TOOL_NAMES } = require('./transcript');
const { formatAuthFailure } = require('./sshAuth');

const WATCH_POLL_MS = 2000;
const SESSION_LIST_LIMIT = 40;

function execCapture(client, cmd, { timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        try { stream.close(); } catch (_) {}
        reject(new Error(`exec timeout after ${timeoutMs}ms: ${cmd}`));
      }, timeoutMs);
      stream.on('data', (d) => { stdout += d.toString('utf8'); });
      stream.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
      stream.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(`${cmd} exited ${code}: ${stderr.trim() || stdout.trim()}`));
      });
    });
  });
}

function sftpPromise(client) {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
  });
}

function sftpReaddir(sftp, dir) {
  return new Promise((resolve, reject) => {
    sftp.readdir(dir, (err, list) => err ? reject(err) : resolve(list || []));
  });
}

function sftpStat(sftp, p) {
  return new Promise((resolve, reject) => {
    sftp.stat(p, (err, stats) => err ? reject(err) : resolve(stats));
  });
}

// Read at most `maxBytes` from the start of a remote file. Used for session
// preview (first record with cwd/branch) and plan picker preview.
function sftpReadHead(sftp, p, maxBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    sftp.open(p, 'r', (err, handle) => {
      if (err) return reject(err);
      const buf = Buffer.alloc(maxBytes);
      sftp.read(handle, buf, 0, maxBytes, 0, (rerr, bytesRead) => {
        sftp.close(handle, () => {});
        if (rerr && rerr.code !== 1 /* EOF */) return reject(rerr);
        resolve(buf.slice(0, bytesRead || 0).toString('utf8'));
      });
    });
  });
}

// Read the last `tailBytes` of a file (used to find the most recent line for
// the session picker "last message" snippet).
function sftpReadTail(sftp, p, size, tailBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const start = Math.max(0, size - tailBytes);
    const len = size - start;
    if (len <= 0) return resolve('');
    sftp.open(p, 'r', (err, handle) => {
      if (err) return reject(err);
      const buf = Buffer.alloc(len);
      sftp.read(handle, buf, 0, len, start, (rerr, bytesRead) => {
        sftp.close(handle, () => {});
        if (rerr && rerr.code !== 1) return reject(rerr);
        resolve(buf.slice(0, bytesRead || 0).toString('utf8'));
      });
    });
  });
}

function sftpReadAll(sftp, p) {
  return new Promise((resolve, reject) => {
    sftp.stat(p, (serr, stats) => {
      if (serr) return reject(serr);
      const size = stats.size || 0;
      sftp.open(p, 'r', (oerr, handle) => {
        if (oerr) return reject(oerr);
        const buf = Buffer.alloc(size);
        if (size === 0) { sftp.close(handle, () => {}); return resolve(''); }
        sftp.read(handle, buf, 0, size, 0, (rerr, bytesRead) => {
          sftp.close(handle, () => {});
          if (rerr && rerr.code !== 1) return reject(rerr);
          resolve(buf.slice(0, bytesRead || 0).toString('utf8'));
        });
      });
    });
  });
}

// Incremental read starting at `cursor` for up to `size - cursor` bytes.
function sftpReadRange(sftp, p, cursor, endSize) {
  return new Promise((resolve, reject) => {
    const len = endSize - cursor;
    if (len <= 0) return resolve('');
    sftp.open(p, 'r', (oerr, handle) => {
      if (oerr) return reject(oerr);
      const buf = Buffer.alloc(len);
      sftp.read(handle, buf, 0, len, cursor, (rerr, bytesRead) => {
        sftp.close(handle, () => {});
        if (rerr && rerr.code !== 1) return reject(rerr);
        resolve(buf.slice(0, bytesRead || 0).toString('utf8'));
      });
    });
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

function openRemote(connectOpts) {
  return new Promise((resolve, reject) => {
    if (connectOpts && connectOpts.authError) {
      return reject(new Error(connectOpts.authError));
    }
    const client = new SshClient();
    let settled = false;
    client.once('ready', async () => {
      try {
        const sftp = await sftpPromise(client);
        settled = true;
        resolve({
          client,
          sftp,
          exec: (cmd, opts) => execCapture(client, cmd, opts),
          close() {
            try { client.end(); } catch (_) {}
          },
        });
      } catch (err) {
        if (!settled) { settled = true; reject(err); }
        try { client.end(); } catch (_) {}
      }
    });
    client.once('error', (err) => {
      if (!settled) {
        settled = true;
        const friendly = formatAuthFailure(err, connectOpts);
        const wrapped = new Error(friendly);
        wrapped.cause = err;
        wrapped.code = err && err.code;
        reject(wrapped);
      }
    });
    client.connect(connectOpts);
  });
}

async function resolveRemoteHome(handle) {
  const out = await handle.exec("printf '%s' \"$HOME\"");
  const home = out.trim();
  if (!home) throw new Error('Could not resolve $HOME on remote host.');
  return home;
}

// Best-effort: find a running `claude` CLI owned by the current user on the
// remote host and return its cwd. Used to filter remote session listings to
// the project the user is actually working in. Failures (no pgrep, no
// /proc, not running) silently return null so the viewer falls back to an
// unfiltered list.
//
// Deprecated — host-scoped, not session-scoped. Prefer `probeRemoteTabSession`
// which ties the detection to THIS ssh tab via source-port matching.
async function probeRemoteClaudeCwd(handle) {
  const cmd = 'pgrep -u "$USER" -n -x claude 2>/dev/null | head -1 | xargs -r -I{} readlink /proc/{}/cwd 2>/dev/null';
  let out;
  try { out = await handle.exec(cmd, { timeoutMs: 1500 }); }
  catch (_) { return null; }
  const cwd = String(out || '').trim();
  return cwd && cwd.startsWith('/') ? cwd : null;
}

// Single-shot bash probe that identifies THIS ssh tab's claude session on the
// remote host. Ties the detection to our specific tcp connection via the
// client-side source port, then walks the per-session sshd's descendants.
// Output (one line, tab-separated): `<tier>\t<sessionPath>\t<cwd>` where tier
// is `sure` | `guess` | `unknown`. Missing fields are empty.
const REMOTE_PROBE_SCRIPT = `#!/bin/bash
set -u
SOURCE_PORT="\${1:-0}"
HOME_DIR="\$HOME"

if [ "\$SOURCE_PORT" = "0" ] || [ -z "\$SOURCE_PORT" ]; then
  printf 'unknown\\t\\t\\n'; exit 0
fi
port_hex=\$(printf '%04X' "\$SOURCE_PORT" 2>/dev/null)
[ -z "\$port_hex" ] && { printf 'unknown\\t\\t\\n'; exit 0; }

list_children() {
  local p=\$1
  for tdir in /proc/\$p/task/*/children; do
    [ -r "\$tdir" ] && tr ' ' '\\n' < "\$tdir" 2>/dev/null
  done | grep -E '^[0-9]+\$' || true
}

is_claude() {
  local p=\$1 i=0
  [ -r "/proc/\$p/cmdline" ] || return 1
  while IFS= read -r arg; do
    i=\$((i+1))
    [ \$i -gt 3 ] && break
    [ -z "\$arg" ] && continue
    case "\${arg##*/}" in claude|claude-code) return 0;; esac
  done < <(tr '\\0' '\\n' < "/proc/\$p/cmdline" 2>/dev/null)
  return 1
}

walk_for_claude() {
  local queue="\$1"
  local visited=""
  while [ -n "\$queue" ]; do
    local pid="\${queue%% *}"
    queue="\${queue#\$pid}"
    queue="\${queue# }"
    case " \$visited " in *" \$pid "*) continue;; esac
    visited="\$visited \$pid"
    is_claude "\$pid" && { echo "\$pid"; return 0; }
    for child in \$(list_children "\$pid"); do
      queue="\$queue \$child"
    done
    queue="\${queue# }"
  done
  return 1
}

find_tmux_client_descendant() {
  local queue="\$1"
  local visited=""
  while [ -n "\$queue" ]; do
    local pid="\${queue%% *}"
    queue="\${queue#\$pid}"
    queue="\${queue# }"
    case " \$visited " in *" \$pid "*) continue;; esac
    visited="\$visited \$pid"
    local comm
    comm=\$(cat "/proc/\$pid/comm" 2>/dev/null)
    case "\$comm" in tmux|tmux:*) echo "\$pid"; return 0;; esac
    for child in \$(list_children "\$pid"); do
      queue="\$queue \$child"
    done
    queue="\${queue# }"
  done
  return 1
}

# Step 1: find the per-session sshd whose socket's peer port == $SOURCE_PORT.
monitor_pid=""
for pid in \$(pgrep -u "\$USER" -f '^sshd: ' 2>/dev/null); do
  [ -d "/proc/\$pid/fd" ] || continue
  for fd in /proc/\$pid/fd/*; do
    tgt=\$(readlink "\$fd" 2>/dev/null) || continue
    case "\$tgt" in socket:\\[*\\]) :;; *) continue;; esac
    inode="\${tgt#socket:[}"; inode="\${inode%]}"
    rem=\$(awk -v i="\$inode" 'NR>1 && \$10==i {print \$3; exit}' /proc/net/tcp /proc/net/tcp6 2>/dev/null)
    [ -z "\$rem" ] && continue
    rem_port=\$(echo "\${rem##*:}" | tr '[:lower:]' '[:upper:]')
    if [ "\$rem_port" = "\$port_hex" ]; then
      monitor_pid="\$pid"
      break 2
    fi
  done
done

[ -z "\$monitor_pid" ] && { printf 'unknown\\t\\t\\n'; exit 0; }

# Step 2: claude descendant of the monitor, directly or via tmux panes.
claude_pid=\$(walk_for_claude "\$monitor_pid")

if [ -z "\$claude_pid" ]; then
  tmux_client=\$(find_tmux_client_descendant "\$monitor_pid")
  if [ -n "\$tmux_client" ]; then
    # Parse -S / -L / -t from argv; fall back to none when absent.
    tmux_s=""; tmux_l=""; tmux_t=""; expect=""
    i=0
    while IFS= read -r a; do
      i=\$((i+1))
      [ \$i -eq 1 ] && continue
      if [ -n "\$expect" ]; then
        case "\$expect" in
          S) tmux_s="\$a";;
          L) tmux_l="\$a";;
          t) tmux_t="\$a";;
        esac
        expect=""
        continue
      fi
      case "\$a" in
        -S) expect=S;;
        -L) expect=L;;
        -t) expect=t;;
      esac
    done < <(tr '\\0' '\\n' < "/proc/\$tmux_client/cmdline" 2>/dev/null)

    base_args=()
    [ -n "\$tmux_s" ] && base_args+=("-S" "\$tmux_s")
    [ -n "\$tmux_l" ] && base_args+=("-L" "\$tmux_l")

    # Ask tmux directly which pane this client is currently displaying. The
    # client is uniquely identified by its tty (one client per tty), so
    # display-message -t <client_tty> resolves to "the pane tmux would render
    # if it redrew that tty right now". No enumeration, no pane_active guess.
    client_tty=\$(tmux "\${base_args[@]}" list-clients -F '#{client_pid} #{client_tty}' 2>/dev/null | awk -v p="\$tmux_client" '\$1==p{print \$2; exit}')
    if [ -n "\$client_tty" ]; then
      pane_pid=\$(tmux "\${base_args[@]}" display-message -t "\$client_tty" -p -F '#{pane_pid}' 2>/dev/null)
      if [ -n "\$pane_pid" ] && [ "\$pane_pid" -eq "\$pane_pid" ] 2>/dev/null; then
        claude_pid=\$(walk_for_claude "\$pane_pid")
      fi
    fi
  fi
fi

[ -z "\$claude_pid" ] && { printf 'unknown\\t\\t\\n'; exit 0; }

# Step 3: resolve the session file for $claude_pid.
claude_cwd=\$(readlink "/proc/\$claude_pid/cwd" 2>/dev/null || echo '')
session_path=""
if [ -d "/proc/\$claude_pid/fd" ]; then
  for fd in /proc/\$claude_pid/fd/*; do
    tgt=\$(readlink "\$fd" 2>/dev/null) || continue
    case "\$tgt" in
      "\$HOME_DIR"/.claude/projects/*.jsonl) session_path="\$tgt"; break;;
    esac
  done
fi

if [ -z "\$session_path" ] && [ -r "/proc/\$claude_pid/environ" ]; then
  sid=\$(tr '\\0' '\\n' < "/proc/\$claude_pid/environ" 2>/dev/null | awk -F= '\$1=="CLAUDE_SESSION_ID"{print \$2; exit}')
  if [ -n "\$sid" ] && [ -n "\$claude_cwd" ]; then
    encoded="-\$(echo "\$claude_cwd" | sed 's/[^a-zA-Z0-9]/-/g')"
    candidate="\$HOME_DIR/.claude/projects/\$encoded/\$sid.jsonl"
    [ -r "\$candidate" ] && session_path="\$candidate"
  fi
fi

if [ -n "\$session_path" ]; then
  printf 'sure\\t%s\\t%s\\n' "\$session_path" "\$claude_cwd"
elif [ -n "\$claude_cwd" ]; then
  printf 'guess\\t\\t%s\\n' "\$claude_cwd"
else
  printf 'unknown\\t\\t\\n'
fi
`;

async function probeRemoteTabSession(handle, sourcePort) {
  const port = Number.isFinite(sourcePort) && sourcePort > 0 ? sourcePort : 0;
  if (port === 0) return { tier: 'unknown', sessionPath: null, cwd: null };
  const b64 = Buffer.from(REMOTE_PROBE_SCRIPT, 'utf8').toString('base64');
  const cmd = `printf %s '${b64}' | base64 -d | bash -s -- ${port}`;
  let out;
  try { out = await handle.exec(cmd, { timeoutMs: 4000 }); }
  catch (_) { return { tier: 'unknown', sessionPath: null, cwd: null }; }
  const line = String(out || '').split('\n').find((l) => l.trim()) || '';
  const parts = line.split('\t');
  const tier = parts[0] || 'unknown';
  const sessionPath = (parts[1] || '').trim() || null;
  const cwd = (parts[2] || '').trim() || null;
  if (tier !== 'sure' && tier !== 'guess' && tier !== 'unknown') {
    return { tier: 'unknown', sessionPath: null, cwd: null };
  }
  return { tier, sessionPath, cwd };
}

// Best-effort: extract a session preview from the head of a transcript.
async function summarizeRemoteSession(handle, fullPath) {
  const { sftp } = handle;
  const stat = await sftpStat(sftp, fullPath);
  if (!stat.isFile()) return null;
  const head = await sftpReadHead(sftp, fullPath, 16 * 1024).catch(() => '');
  const tail = stat.size > 1024
    ? await sftpReadTail(sftp, fullPath, stat.size, 4096).catch(() => '')
    : head;

  // Walk the head to find the first record carrying cwd / sessionId.
  let firstRec = null;
  for (const line of head.split('\n')) {
    if (!line) continue;
    const rec = safeParseLine(line);
    if (!rec) continue;
    if (!firstRec) firstRec = rec;
    if (rec.cwd) { firstRec = rec; break; }
  }
  const preview = extractSessionPreview(firstRec) || {};

  // Snippet from the last non-empty line in the tail.
  let snippet = '';
  const tailLines = tail.split('\n').filter(Boolean);
  const lastRec = tailLines.length ? safeParseLine(tailLines[tailLines.length - 1]) : null;
  const grabText = (rec) => {
    if (!rec) return '';
    const msg = rec.message;
    if (!msg) return '';
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      for (const c of msg.content) {
        if (c && c.type === 'text' && typeof c.text === 'string') return c.text;
      }
    }
    return '';
  };
  snippet = (grabText(lastRec) || grabText(firstRec) || '').slice(0, 160).trim();

  const baseName = fullPath.split('/').pop() || '';
  const sessionId = preview.sessionId || baseName.replace(/\.jsonl$/, '');
  return {
    sessionId,
    filePath: fullPath,
    cwd: preview.cwd || null,
    gitBranch: preview.gitBranch || null,
    startedAt: preview.timestamp || null,
    updatedAt: stat.mtime ? new Date(stat.mtime * 1000).toISOString() : null,
    sizeBytes: stat.size,
    snippet,
  };
}

// List remote sessions across every project on the host. When `projectCwd`
// is supplied, sessions whose encoded project dir matches float to the top
// (secondary sort: mtime desc). When it's not, pure mtime desc. Never
// filters — the picker always shows every session so the user can pick
// across projects even when the tab-scoped probe is uncertain.
async function listRemoteSessions(handle, { remoteHome, projectCwd = null, limit = SESSION_LIST_LIMIT } = {}) {
  const { sftp } = handle;
  const projectsRoot = `${remoteHome}/.claude/projects`;
  const encoded = projectCwd ? projectEncodedName(projectCwd) : null;

  const candidates = [];
  async function scanProject(dirName) {
    const dir = `${projectsRoot}/${dirName}`;
    let entries;
    try { entries = await sftpReaddir(sftp, dir); }
    catch (_) { return; }
    for (const e of entries) {
      if (!e.filename.endsWith('.jsonl')) continue;
      const full = `${dir}/${e.filename}`;
      const mtime = (e.attrs && e.attrs.mtime) || 0;
      candidates.push({ dir, dirName, full, mtime });
    }
  }

  let top;
  try { top = await sftpReaddir(sftp, projectsRoot); }
  catch (err) {
    console.warn('[diff/remote] listRemoteSessions readdir failed:', projectsRoot, err && err.message);
    const e = new Error(`${err.code || 'error'}: ${err.message || String(err)} (${projectsRoot})`);
    e.cause = err;
    e.path = projectsRoot;
    throw e;
  }
  await Promise.all(top.map((d) => scanProject(d.filename)));

  candidates.sort((a, b) => {
    const aMatch = encoded && a.dirName === encoded ? 0 : 1;
    const bMatch = encoded && b.dirName === encoded ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return (b.mtime || 0) - (a.mtime || 0);
  });

  const topN = candidates.slice(0, limit);
  const results = await Promise.all(topN.map(async (c) => {
    try { return await summarizeRemoteSession(handle, c.full); }
    catch (_) { return null; }
  }));
  return results.filter(Boolean);
}

function projectEncodedName(cwd) {
  if (!cwd) return null;
  return '-' + cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

async function listRemotePlans(handle, { remoteHome } = {}) {
  const { sftp } = handle;
  const plansDir = `${remoteHome}/.claude/plans`;
  let entries;
  try { entries = await sftpReaddir(sftp, plansDir); }
  catch (err) {
    console.warn('[plan/remote] listRemotePlans readdir failed:', plansDir, err && err.message);
    const e = new Error(`${err.code || 'error'}: ${err.message || String(err)} (${plansDir})`);
    e.cause = err;
    e.path = plansDir;
    throw e;
  }
  const results = [];
  for (const entry of entries) {
    const name = entry.filename;
    if (!name.endsWith('.md')) continue;
    const full = `${plansDir}/${name}`;
    const attrs = entry.attrs || {};
    const size = attrs.size || 0;
    const mtimeSec = attrs.mtime || 0;
    let heading = null, paragraph = null;
    try {
      const head = await sftpReadHead(sftp, full, 4096);
      const p = extractPreview(head);
      heading = p.heading;
      paragraph = p.paragraph;
    } catch (_) { /* per-file read errors are non-fatal */ }
    results.push({
      path: full,
      name,
      slug: name.replace(/\.md$/, ''),
      sizeBytes: size,
      mtimeMs: mtimeSec * 1000,
      mtime: mtimeSec ? new Date(mtimeSec * 1000).toISOString() : null,
      heading,
      paragraph,
    });
  }
  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results;
}

// Remote counterpart of planSource.listPlansForSession. Reads the remote
// session JSONL over SFTP, collects plan paths written by tool calls, then
// stats each to return the same shape as listRemotePlans, newest-first.
async function listRemotePlansForSession(handle, { remoteSessionPath, remotePlansDir } = {}) {
  if (!remoteSessionPath || !remotePlansDir) return [];
  const { sftp } = handle;
  let contents;
  try { contents = await sftpReadAll(sftp, remoteSessionPath); }
  catch (err) {
    if (err && (err.code === 2 || /no such file/i.test(err.message || ''))) return [];
    console.warn('[plan/remote] listRemotePlansForSession read failed:', remoteSessionPath, err && err.message);
    return [];
  }
  const seen = new Set();
  const prefix = remotePlansDir.endsWith('/') ? remotePlansDir : remotePlansDir + '/';
  for (const line of contents.split('\n')) {
    if (!line) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    const msg = rec && rec.message;
    const content = msg && Array.isArray(msg.content) ? msg.content : null;
    if (!content) continue;
    for (const c of content) {
      if (!c || c.type !== 'tool_use' || !EDIT_TOOL_NAMES.has(c.name)) continue;
      const fp = c.input && c.input.file_path;
      if (typeof fp !== 'string') continue;
      if (fp.startsWith(prefix)) seen.add(fp);
    }
  }
  const paths = Array.from(seen);
  const results = await Promise.all(paths.map(async (fp) => {
    try {
      const stat = await sftpStat(sftp, fp);
      if (!stat.isFile()) return null;
      const name = fp.split('/').pop() || fp;
      let heading = null, paragraph = null;
      try {
        const head = await sftpReadHead(sftp, fp, 4096);
        const p = extractPreview(head);
        heading = p.heading;
        paragraph = p.paragraph;
      } catch (_) { /* non-fatal */ }
      const mtimeSec = stat.mtime || 0;
      return {
        path: fp,
        name,
        slug: name.replace(/\.md$/, ''),
        sizeBytes: stat.size || 0,
        mtimeMs: mtimeSec * 1000,
        mtime: mtimeSec ? new Date(mtimeSec * 1000).toISOString() : null,
        heading,
        paragraph,
      };
    } catch (_) { return null; }
  }));
  return results.filter(Boolean).sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function extractPreview(md) {
  if (!md) return { heading: null, paragraph: null };
  const lines = md.split('\n');
  let heading = null;
  let paragraph = null;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (!heading && trimmed.startsWith('#')) {
      heading = trimmed.replace(/^#+\s*/, '').slice(0, 120);
      continue;
    }
    if (heading && !paragraph && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      paragraph = trimmed.slice(0, 180);
      break;
    }
    if (!heading && !paragraph && !trimmed.startsWith('---')) {
      paragraph = trimmed.slice(0, 180);
    }
  }
  return { heading, paragraph };
}

function readRemoteFile(handle, path) {
  return sftpReadAll(handle.sftp, path);
}

// Poll stat every `intervalMs`; when size grows, emit the appended slice as
// raw text. Matches localSource.watchSession's semantics for JSONL tailing.
function watchRemoteFile(handle, path, { onData, onError, onRemoved, intervalMs = WATCH_POLL_MS } = {}) {
  const { sftp } = handle;
  let closed = false;
  let cursor = 0;
  let knownSize = 0;
  let busy = false;

  const tick = async () => {
    if (closed || busy) return;
    busy = true;
    try {
      const st = await sftpStat(sftp, path);
      const size = st.size || 0;
      if (size < knownSize) {
        // Truncated / rotated — re-sync.
        cursor = 0;
      }
      if (size > cursor) {
        const chunk = await sftpReadRange(sftp, path, cursor, size);
        cursor = size;
        if (onData) onData(chunk);
      }
      knownSize = size;
    } catch (err) {
      if (err && (err.code === 2 /* ENOENT */ || /no such file/i.test(err.message || ''))) {
        if (onRemoved) onRemoved();
      } else if (onError) {
        onError(err);
      }
    } finally {
      busy = false;
    }
  };

  tick(); // initial catch-up
  const timer = setInterval(tick, intervalMs);

  return {
    stop() {
      closed = true;
      clearInterval(timer);
    },
  };
}

// Full-content poll-watch variant for markdown plans (no cursor — the whole
// file is re-read whenever mtime changes).
function watchRemotePlan(handle, path, { onChange, onError, onRemoved, intervalMs = WATCH_POLL_MS } = {}) {
  const { sftp } = handle;
  let closed = false;
  let lastMtime = 0;
  let busy = false;

  const tick = async () => {
    if (closed || busy) return;
    busy = true;
    try {
      const st = await sftpStat(sftp, path);
      const m = st.mtime || 0;
      if (m !== lastMtime) {
        lastMtime = m;
        const content = await sftpReadAll(sftp, path);
        const iso = m ? new Date(m * 1000).toISOString() : null;
        if (onChange) onChange({ content, mtime: iso });
      }
    } catch (err) {
      if (err && (err.code === 2 || /no such file/i.test(err.message || ''))) {
        if (onRemoved) onRemoved();
      } else if (onError) onError(err);
    } finally {
      busy = false;
    }
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  return {
    stop() {
      closed = true;
      clearInterval(timer);
    },
  };
}

module.exports = {
  openRemote,
  resolveRemoteHome,
  probeRemoteClaudeCwd,
  probeRemoteTabSession,
  listRemoteSessions,
  listRemotePlans,
  listRemotePlansForSession,
  readRemoteFile,
  watchRemoteFile,
  watchRemotePlan,
  projectEncodedName,
  // exported for tests
  extractPreview,
  summarizeRemoteSession,
};

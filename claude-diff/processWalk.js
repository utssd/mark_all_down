// Process-tree helpers used by the Claude pop-ups to resolve a terminal tab's
// real working directory across four contexts: local plain, local + tmux,
// SSH, and SSH + remote tmux. Linux-only — on macOS / Windows every entry
// point returns `null` so callers fall through to legacy behavior.
//
// The tricky scenario is local + tmux. A tmux client on the tab's PTY
// connects to the tmux server over a socket; Claude Code runs under the
// tmux server's pane PTY, NOT under the tab's PTY. `readlink /proc/<pty>/cwd`
// gives the shell's cwd, which is usually wrong. We instead locate the tmux
// client, ask tmux for the active pane's pid, and walk that for the Claude
// CLI.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Run a program asynchronously with a hard timeout; resolve with stdout on
// success, or null if it fails / times out. `execFile` with `timeout` sends
// SIGTERM to the child and does NOT block the main thread — this is the whole
// point of this helper over `execFileSync`.
function execToString(file, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(file, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      // Drop stdin and stderr; we only consume stdout.
      stdio: ['ignore', 'pipe', 'ignore'],
    }, (err, stdout) => {
      if (err) resolve(null);
      else resolve(stdout);
    });
  });
}

const PROC = '/proc';
const SUPPORTED = process.platform === 'linux';

function readChildPids(pid) {
  if (!SUPPORTED) return [];
  const taskDir = `${PROC}/${pid}/task`;
  let tids;
  try { tids = fs.readdirSync(taskDir); } catch { return []; }
  const out = new Set();
  for (const tid of tids) {
    let raw;
    try { raw = fs.readFileSync(`${taskDir}/${tid}/children`, 'utf8'); } catch { continue; }
    for (const token of raw.split(/\s+/)) {
      const n = Number(token);
      if (Number.isInteger(n) && n > 0) out.add(n);
    }
  }
  return Array.from(out);
}

function readComm(pid) {
  if (!SUPPORTED) return null;
  try { return fs.readFileSync(`${PROC}/${pid}/comm`, 'utf8').trim(); }
  catch { return null; }
}

function readCmdline(pid) {
  if (!SUPPORTED) return null;
  let raw;
  try { raw = fs.readFileSync(`${PROC}/${pid}/cmdline`); }
  catch { return null; }
  if (!raw || raw.length === 0) return null;
  const parts = raw.toString('utf8').split('\0');
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.length ? parts : null;
}

function readCwdLink(pid) {
  if (!SUPPORTED || !Number.isInteger(pid) || pid <= 0) return null;
  try { return fs.readlinkSync(`${PROC}/${pid}/cwd`); }
  catch { return null; }
}

// BFS the process tree rooted at `rootPid`. Calls `matchFn(pid, comm, argv)`
// for every non-root descendant; returns the first pid for which it returns
// truthy, else null. `maxDepth` keeps us from wandering too far.
function bfsDescendants(rootPid, matchFn, maxDepth = 8) {
  if (!SUPPORTED || !Number.isInteger(rootPid) || rootPid <= 0) return null;
  const visited = new Set();
  const queue = [{ pid: rootPid, depth: 0 }];
  while (queue.length) {
    const { pid, depth } = queue.shift();
    if (visited.has(pid)) continue;
    visited.add(pid);
    if (depth > 0) {
      const comm = readComm(pid);
      const argv = readCmdline(pid);
      if (matchFn(pid, comm, argv)) return pid;
    }
    if (depth >= maxDepth) continue;
    for (const child of readChildPids(pid)) queue.push({ pid: child, depth: depth + 1 });
  }
  return null;
}

// Is this process the Claude Code CLI? Typical invocations:
//   /home/user/.nvm/versions/node/.../bin/node /.../bin/claude ...
//   /usr/local/bin/claude
//   claude-code
// We check basenames of the first few argv elements for a match.
function isClaudeCli(argv) {
  if (!argv || !argv.length) return false;
  const check = (s) => {
    const b = path.basename(String(s || ''));
    return b === 'claude' || b === 'claude-code';
  };
  for (let i = 0; i < Math.min(argv.length, 3); i++) {
    if (check(argv[i])) return true;
  }
  return false;
}

function findClaudeCli(rootPid) {
  const pid = bfsDescendants(rootPid, (_p, _comm, argv) => isClaudeCli(argv));
  if (!pid) return null;
  const cwd = readCwdLink(pid);
  return { pid, cwd };
}

// Find a tmux *client* in the descendants of rootPid. The client's cmdline
// tells us which socket and (usually) which session it's attached to.
function findTmuxClient(rootPid) {
  const pid = bfsDescendants(rootPid, (_p, comm) => {
    if (!comm) return false;
    // comm is truncated to 15 chars; values we might see: "tmux", "tmux: client".
    return comm === 'tmux' || comm.startsWith('tmux:');
  });
  if (!pid) return null;
  const argv = readCmdline(pid) || [];
  let socket = null;       // -S <socket-path>
  let socketName = null;   // -L <socket-name>
  let sessionName = null;  // -t <session>
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-S' && argv[i + 1]) { socket = argv[i + 1]; i++; continue; }
    if (a === '-L' && argv[i + 1]) { socketName = argv[i + 1]; i++; continue; }
    if (a === '-t' && argv[i + 1]) { sessionName = argv[i + 1]; i++; continue; }
  }
  return { pid, socket, socketName, sessionName };
}

function tmuxBaseArgs(info) {
  const args = [];
  if (info.socket) args.push('-S', info.socket);
  else if (info.socketName) args.push('-L', info.socketName);
  return args;
}

// Resolve the tmux session name for a given client pid via `list-clients`.
// Used when the client's own cmdline didn't include `-t <session>`.
async function tmuxSessionForClient(info) {
  if (info.sessionName) return info.sessionName;
  const out = await execToString(
    'tmux',
    [...tmuxBaseArgs(info), 'list-clients', '-F', '#{client_pid}:#{session_name}'],
    500,
  );
  if (!out) return null;
  for (const line of out.split('\n')) {
    const [pidStr, sess] = line.split(':');
    if (Number(pidStr) === info.pid && sess) return sess;
  }
  return null;
}

// Given tmux client info, return the PID of the currently-active pane of the
// session that client is attached to, or null if tmux can't be queried.
async function tmuxActivePanePid(info) {
  if (!info) return null;
  const session = await tmuxSessionForClient(info);
  const args = [...tmuxBaseArgs(info), 'display-message', '-p'];
  if (session) args.push('-t', session);
  args.push('-F', '#{pane_pid}');
  const out = await execToString('tmux', args, 500);
  if (!out) return null;
  const n = parseInt(out.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// List every pane of the session the tmux client is attached to. The active
// pane is flagged so the caller can prefer it when disambiguating.
async function tmuxListPanePids(info) {
  if (!info) return [];
  const session = await tmuxSessionForClient(info);
  const args = [...tmuxBaseArgs(info), 'list-panes', '-s'];
  if (session) args.push('-t', session);
  args.push('-F', '#{pane_pid} #{pane_active} #{window_index} #{pane_index}');
  const out = await execToString('tmux', args, 500);
  if (!out) return [];
  const result = [];
  for (const line of out.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const pid = parseInt(parts[0], 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    result.push({
      pid,
      active: parts[1] === '1',
      windowIndex: parts[2] ? parseInt(parts[2], 10) : null,
      paneIndex: parts[3] ? parseInt(parts[3], 10) : null,
    });
  }
  return result;
}

// Scan /proc/<pid>/fd/ for an open symlink pointing at a .jsonl file under
// <homeDir>/.claude/projects/. Returns the absolute path or null.
function readOpenJsonl(pid, homeDir) {
  if (!SUPPORTED || !Number.isInteger(pid) || pid <= 0 || !homeDir) return null;
  const fdDir = `${PROC}/${pid}/fd`;
  let entries;
  try { entries = fs.readdirSync(fdDir); } catch { return null; }
  const prefix = `${homeDir}/.claude/projects/`;
  for (const e of entries) {
    let target;
    try { target = fs.readlinkSync(`${fdDir}/${e}`); } catch { continue; }
    if (target.startsWith(prefix) && target.endsWith('.jsonl')) return target;
  }
  return null;
}

// Parse /proc/<pid>/environ (NUL-separated KEY=VAL) for CLAUDE_SESSION_ID.
function readClaudeSessionEnv(pid) {
  if (!SUPPORTED || !Number.isInteger(pid) || pid <= 0) return null;
  let raw;
  try { raw = fs.readFileSync(`${PROC}/${pid}/environ`, 'utf8'); } catch { return null; }
  for (const entry of raw.split('\0')) {
    if (!entry) continue;
    const eq = entry.indexOf('=');
    if (eq < 0) continue;
    if (entry.slice(0, eq) === 'CLAUDE_SESSION_ID') return entry.slice(eq + 1);
  }
  return null;
}

// Resolve a claude PID's session file. Preferred: open .jsonl fd. Fallback:
// CLAUDE_SESSION_ID env + cwd composed through the same encoding Claude Code
// uses for project dirs. Returns { sessionPath, sessionId } or null.
function sessionPathFromPid(pid, homeDir) {
  const direct = readOpenJsonl(pid, homeDir);
  if (direct) {
    const m = /\/([^/]+)\.jsonl$/.exec(direct);
    return { sessionPath: direct, sessionId: m ? m[1] : null };
  }
  const sid = readClaudeSessionEnv(pid);
  if (!sid) return null;
  const cwd = readCwdLink(pid);
  if (!cwd) return null;
  // Claude's encoding: non-alphanum → '-', leading '/' becomes the leading
  // '-' naturally. Do NOT prepend an extra '-'.
  const encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-');
  const candidate = `${homeDir}/.claude/projects/${encoded}/${sid}.jsonl`;
  try {
    if (fs.statSync(candidate).isFile()) return { sessionPath: candidate, sessionId: sid };
  } catch { /* fall through */ }
  return null;
}

// Resolve THIS tab's claude PID with a confidence tier.
//   sure     — exactly one claude descendant, or the active tmux pane's claude
//   guess    — multiple candidates with no active-pane preference
//   unknown  — no claude descendant found
async function resolveLocalClaudePid(rootPid) {
  if (!SUPPORTED || !Number.isInteger(rootPid)) return { claudePid: null, tier: 'unknown' };

  // Plain shell: direct descendant.
  const direct = findClaudeCli(rootPid);
  if (direct && direct.pid) return { claudePid: direct.pid, tier: 'sure' };

  // tmux: the pane shells are under the tmux server, not the client — walk
  // every pane in the client's session.
  const tmux = findTmuxClient(rootPid);
  if (!tmux) return { claudePid: null, tier: 'unknown' };

  const panes = await tmuxListPanePids(tmux);
  const candidates = [];
  for (const pane of panes) {
    const pid = bfsDescendants(pane.pid, (_p, _c, argv) => isClaudeCli(argv));
    if (pid) candidates.push({ claudePid: pid, active: pane.active });
  }
  if (!candidates.length) return { claudePid: null, tier: 'unknown' };
  if (candidates.length === 1) return { claudePid: candidates[0].claudePid, tier: 'sure' };
  const activeMatch = candidates.find((c) => c.active);
  if (activeMatch) return { claudePid: activeMatch.claudePid, tier: 'sure' };
  candidates.sort((a, b) => b.claudePid - a.claudePid);
  return { claudePid: candidates[0].claudePid, tier: 'guess' };
}

module.exports = {
  readChildPids,
  readComm,
  readCmdline,
  readCwdLink,
  bfsDescendants,
  findClaudeCli,
  findTmuxClient,
  tmuxActivePanePid,
  tmuxListPanePids,
  readOpenJsonl,
  readClaudeSessionEnv,
  sessionPathFromPid,
  resolveLocalClaudePid,
  isClaudeCli,
};

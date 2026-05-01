// Cross-platform process-tree reads used by SSH detection.
//
// Linux reads from /proc directly (fast, no fork). macOS shells out to `ps`
// once per detection call and caches the snapshot for ~200 ms. Windows is
// unsupported — all entry points return empty/null and callers fall back to
// local-only behavior.

'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');

const PROC = '/proc';
const PLATFORM = process.platform;
const IS_LINUX = PLATFORM === 'linux';
const IS_DARWIN = PLATFORM === 'darwin';

function isSupported() {
  return IS_LINUX || IS_DARWIN;
}

// ── Linux (/proc) ──────────────────────────────────────────────────────────

function linuxReadChildPids(pid) {
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

function linuxReadComm(pid) {
  try { return fs.readFileSync(`${PROC}/${pid}/comm`, 'utf8').trim(); }
  catch { return null; }
}

function linuxReadCmdline(pid) {
  let raw;
  try { raw = fs.readFileSync(`${PROC}/${pid}/cmdline`); }
  catch { return null; }
  if (!raw || raw.length === 0) return null;
  const parts = raw.toString('utf8').split('\0');
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts.length ? parts : null;
}

// ── macOS (ps) ─────────────────────────────────────────────────────────────
//
// One `ps -A` call builds a full process snapshot (children map + comm map).
// A per-pid `ps -ww -p <pid> -o command=` call fetches argv when needed.
// Both calls are strictly bounded by a 500 ms timeout.

const SNAPSHOT_TTL_MS = 200;
let _darwinSnapshot = null;
let _darwinSnapshotAt = 0;

function darwinBuildSnapshot() {
  const now = Date.now();
  if (_darwinSnapshot && (now - _darwinSnapshotAt) < SNAPSHOT_TTL_MS) {
    return _darwinSnapshot;
  }
  let out;
  try {
    out = execFileSync('/bin/ps', ['-A', '-o', 'pid=,ppid=,comm='], {
      encoding: 'utf8',
      timeout: 500,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    _darwinSnapshot = { children: new Map(), comm: new Map() };
    _darwinSnapshotAt = now;
    return _darwinSnapshot;
  }
  const children = new Map();
  const comm = new Map();
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const pid = Number(m[1]);
    const ppid = Number(m[2]);
    const raw = m[3].trim();
    // macOS ps comm can be a full path; reduce to basename.
    const base = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw;
    comm.set(pid, base);
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  _darwinSnapshot = { children, comm };
  _darwinSnapshotAt = now;
  return _darwinSnapshot;
}

function darwinReadChildPids(pid) {
  const snap = darwinBuildSnapshot();
  return snap.children.get(pid) || [];
}

function darwinReadComm(pid) {
  const snap = darwinBuildSnapshot();
  return snap.comm.get(pid) || null;
}

// Tokenize a shell-ish command line into argv. ssh argv in the wild never
// uses shell quoting in ways that matter for our parsing (host, -i PATH,
// -p PORT, -l USER, -o KEY=VAL). Plain whitespace split is good enough.
function tokenizeCommand(cmd) {
  if (!cmd) return null;
  const trimmed = cmd.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/);
}

function darwinReadCmdline(pid) {
  let out;
  try {
    out = execFileSync('/bin/ps', ['-ww', '-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
      timeout: 500,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  return tokenizeCommand(out);
}

// ── Public dispatch ────────────────────────────────────────────────────────

function readChildPids(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return [];
  if (IS_LINUX) return linuxReadChildPids(pid);
  if (IS_DARWIN) return darwinReadChildPids(pid);
  return [];
}

function readComm(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (IS_LINUX) return linuxReadComm(pid);
  if (IS_DARWIN) return darwinReadComm(pid);
  return null;
}

function readCmdline(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (IS_LINUX) return linuxReadCmdline(pid);
  if (IS_DARWIN) return darwinReadCmdline(pid);
  return null;
}

module.exports = {
  isSupported,
  readChildPids,
  readComm,
  readCmdline,
};

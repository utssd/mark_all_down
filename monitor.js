// Lightweight, always-on resource monitor for MAD.
//
// Periodically samples per-process fd/shmem/memory/cpu and appends a JSONL
// entry to <userData>/logs/mad-monitor.log — but ONLY when something
// changed meaningfully since the last tick, plus a 10-minute heartbeat so a
// flat log still proves the sampler is alive.
//
// Linux: uses /proc/<pid>/fd directly.
// macOS: falls back to app.getAppMetrics() only (no FD detail — lsof is too
//        heavy for a 60s sampler). Set fd/shm/deleted to null.
// Windows: disabled.
//
// Designed for negligible overhead: one setInterval, one file handle,
// readdir+readlink only on Linux, no heavy shell-outs.

const fs = require('fs');
const path = require('path');

const TICK_MS = 60_000;
const HEARTBEAT_MS = 10 * 60_000;
const SHM_DELTA_THRESHOLD = 1;
const FD_DELTA_THRESHOLD = 10;
const MAX_LOG_BYTES = 5 * 1024 * 1024;

function sampleLinuxFd(pid) {
  try {
    const dir = '/proc/' + pid + '/fd';
    const entries = fs.readdirSync(dir);
    let shm = 0;
    let deleted = 0;
    for (const e of entries) {
      try {
        const target = fs.readlinkSync(path.join(dir, e));
        if (target.includes('org.chromium.Chromium')) shm++;
        if (target.endsWith(' (deleted)')) deleted++;
      } catch (_) {
        // fd closed between readdir and readlink; ignore
      }
    }
    return { fd: entries.length, shm, deleted };
  } catch (_) {
    return { fd: null, shm: null, deleted: null };
  }
}

function sampleProcess(pid, platform) {
  if (platform === 'linux') return sampleLinuxFd(pid);
  return { fd: null, shm: null, deleted: null };
}

function collectSamples(electronApp, platform) {
  const out = [];
  let metrics = [];
  try {
    metrics = electronApp.getAppMetrics();
  } catch (_) {}

  const seen = new Set();
  for (const m of metrics) {
    seen.add(m.pid);
    const fdInfo = sampleProcess(m.pid, platform);
    out.push({
      pid: m.pid,
      type: m.type || 'unknown',
      cpu: Math.round((m.cpu?.percentCPU || 0) * 10) / 10,
      rssKB: m.memory?.workingSetSize || 0,
      ...fdInfo,
    });
  }

  // main process may not always appear in getAppMetrics uniformly; ensure it's there
  if (!seen.has(process.pid)) {
    const fdInfo = sampleProcess(process.pid, platform);
    out.push({
      pid: process.pid,
      type: 'Browser',
      cpu: null,
      rssKB: Math.round(process.memoryUsage().rss / 1024),
      ...fdInfo,
    });
  }
  return out;
}

function shouldWrite(prev, curr) {
  if (prev.size !== curr.length) return true;
  for (const p of curr) {
    const old = prev.get(p.pid);
    if (!old) return true;
    if (p.shm != null && old.shm != null && Math.abs(p.shm - old.shm) >= SHM_DELTA_THRESHOLD) return true;
    if (p.fd != null && old.fd != null && Math.abs(p.fd - old.fd) >= FD_DELTA_THRESHOLD) return true;
  }
  return false;
}

function updatePrev(prev, curr) {
  prev.clear();
  for (const p of curr) prev.set(p.pid, { fd: p.fd, shm: p.shm });
}

function rotateIfLarge(logPath) {
  try {
    const st = fs.statSync(logPath);
    if (st.size > MAX_LOG_BYTES) {
      try { fs.renameSync(logPath, logPath + '.1'); } catch (_) {}
    }
  } catch (_) {
    // does not exist yet
  }
}

function readRlimit() {
  try {
    const txt = fs.readFileSync('/proc/self/limits', 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('Max open files'));
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    // "Max open files  soft  hard  files"
    const soft = parts[parts.length - 3];
    const hard = parts[parts.length - 2];
    return { soft: Number(soft), hard: Number(hard) };
  } catch (_) {
    return null;
  }
}

function tryBumpFdLimit() {
  // Linux-only. Use `prlimit --pid=<self> --nofile=N:N` which invokes the
  // prlimit64 syscall on our own process. Never lower the current soft
  // limit — some shells already raise it to 1048576 via pam_limits; we
  // only help when Electron was launched with the stock 1024 ceiling.
  if (process.platform !== 'linux') return { attempted: false };
  const before = readRlimit();
  if (!before) return { attempted: false, reason: 'no /proc/self/limits' };
  const desiredSoft = Math.min(65536, before.hard);
  if (before.soft >= desiredSoft) {
    return { attempted: false, reason: 'already sufficient', before };
  }
  try {
    const { execFileSync } = require('child_process');
    execFileSync(
      'prlimit',
      ['--pid=' + process.pid, '--nofile=' + desiredSoft + ':' + before.hard],
      { stdio: 'ignore', timeout: 2000 }
    );
    const after = readRlimit();
    return { attempted: true, before, after, target: desiredSoft };
  } catch (err) {
    return { attempted: true, before, error: err.message };
  }
}

function readChildRlimit(pid) {
  // Same format as readRlimit() but for an arbitrary pid.
  try {
    const txt = fs.readFileSync('/proc/' + pid + '/limits', 'utf8');
    const line = txt.split('\n').find((l) => l.startsWith('Max open files'));
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    return { soft: Number(parts[parts.length - 3]), hard: Number(parts[parts.length - 2]) };
  } catch (_) { return null; }
}

// Chromium's zygote and renderer sandboxing resets RLIMIT_NOFILE to the
// Linux default (1024) regardless of what we set on the parent. Since we
// own those processes and their hard ceiling is ~1M, we can prlimit them
// from outside. Called on every monitor tick; no-ops children that are
// already raised.
function bumpChildLimits(pids, target) {
  if (process.platform !== 'linux') return { bumped: [], skipped: [] };
  const bumped = [];
  const skipped = [];
  let execFileSync;
  try { ({ execFileSync } = require('child_process')); } catch (_) { return { bumped, skipped }; }
  for (const pid of pids) {
    if (!pid || pid === process.pid) continue;
    const lim = readChildRlimit(pid);
    if (!lim) { skipped.push({ pid, reason: 'no-limits' }); continue; }
    if (lim.soft >= target) { continue; }
    const newHard = Math.max(lim.hard, target);
    try {
      execFileSync('prlimit', ['--pid=' + pid, '--nofile=' + target + ':' + newHard],
        { stdio: 'ignore', timeout: 2000 });
      bumped.push({ pid, before: lim, target });
    } catch (err) {
      skipped.push({ pid, reason: 'prlimit-failed', error: err.message });
    }
  }
  return { bumped, skipped };
}

function startMonitor({ app: electronApp, appVersion }) {
  if (process.platform === 'win32') {
    return { stop: () => {} };
  }

  const userData = electronApp.getPath('userData');
  const logDir = path.join(userData, 'logs');
  const logPath = path.join(logDir, 'mad-monitor.log');

  try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) {}
  rotateIfLarge(logPath);

  let stream;
  try {
    stream = fs.createWriteStream(logPath, { flags: 'a' });
  } catch (_) {
    return { stop: () => {} };
  }

  const append = (event, extra) => {
    try {
      const line = JSON.stringify({ ts: new Date().toISOString(), event, ...extra }) + '\n';
      stream.write(line);
    } catch (_) {}
  };

  const rlimitResult = tryBumpFdLimit();
  append('startup', {
    appVersion: appVersion || null,
    electron: process.versions.electron || null,
    node: process.versions.node,
    platform: process.platform,
    pid: process.pid,
    userData,
    rlimit: rlimitResult,
  });

  const prev = new Map();
  let lastWrite = Date.now();

  const tick = () => {
    const samples = collectSamples(electronApp, process.platform);
    // Chromium renderers + zygotes spawn with soft=1024 regardless of what
    // the parent sets. Bump them from outside every tick; cheap when
    // nothing needs bumping.
    const bumpTarget = 65536;
    const pids = samples.map((s) => s.pid).filter((p) => p && p !== process.pid);
    const bump = bumpChildLimits(pids, bumpTarget);
    if (bump.bumped.length > 0) append('child_rlimit_bumped', bump);

    const now = Date.now();
    const diff = shouldWrite(prev, samples);
    const heartbeat = now - lastWrite >= HEARTBEAT_MS;
    if (diff || heartbeat) {
      append(diff ? 'tick' : 'heartbeat', { pids: samples });
      lastWrite = now;
    }
    updatePrev(prev, samples);
  };

  // First sample after 5s to catch early growth.
  const initialT = setTimeout(tick, 5000);
  const intervalT = setInterval(tick, TICK_MS);

  return {
    stop: () => {
      clearTimeout(initialT);
      clearInterval(intervalT);
      try { stream.end(); } catch (_) {}
    },
  };
}

module.exports = { startMonitor, tryBumpFdLimit };

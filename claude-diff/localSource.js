// Local transcript source: fs.watch-based tail + session directory listing.
//
// Does NOT read source files — the viewer renders hunks straight out of the
// tool_result payload. The only filesystem touch is the transcript JSONL.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseLineBuffer, safeParseLine, extractSessionPreview, lineLooksInteresting } = require('./transcript');

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SESSION_LIST_LIMIT = 20;

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

// Decode Claude Code's project directory name convention: cwd with "/"
// replaced by "-", prefixed with "-". Reverses by swapping "-" back to "/"
// but this is ambiguous when paths contain dashes. We only use the preview's
// own `cwd` field for display; decoding is a fallback when the file is empty.
function decodeProjectDirName(name) {
  if (!name) return null;
  if (name.startsWith('-')) return name.slice(1).replace(/-/g, '/');
  return name.replace(/-/g, '/');
}

// Read last N bytes of a file and return the last complete line. Used for
// picker previews to show "last user message snippet".
function readLastLine(filePath, stat) {
  return new Promise((resolve) => {
    const size = stat.size;
    if (size === 0) return resolve(null);
    const readBytes = Math.min(size, 64 * 1024);
    const position = size - readBytes;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readBytes);
    fs.read(fd, buf, 0, readBytes, position, (err, _n, result) => {
      fs.close(fd, () => {});
      if (err) return resolve(null);
      const text = result.toString('utf8');
      const lines = text.split('\n').filter(Boolean);
      resolve(lines.length ? lines[lines.length - 1] : null);
    });
  });
}

// Read the first chunk of the file and return the first record that carries a
// `cwd` field. Modern Claude Code writes a `permission-mode` record first —
// we have to scan a bit further to find the session header.
function readHeaderRecord(filePath) {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024, end: 128 * 1024 });
    let buf = '';
    let settled = false;
    let firstRec = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      stream.destroy();
      resolve(firstRec);
    };
    stream.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const rec = safeParseLine(line);
        if (!rec) continue;
        if (!firstRec) firstRec = rec;
        if (rec.cwd) { firstRec = rec; finish(); return; }
      }
    });
    stream.on('end', finish);
    stream.on('error', finish);
  });
}

async function summarizeSessionFile(dirPath, fileName) {
  const fullPath = path.join(dirPath, fileName);
  let stat;
  try { stat = fs.statSync(fullPath); } catch { return null; }
  if (!stat.isFile()) return null;
  const [firstRec, lastLine] = await Promise.all([
    readHeaderRecord(fullPath),
    readLastLine(fullPath, stat),
  ]);
  const lastRec = lastLine ? safeParseLine(lastLine) : null;
  const preview = extractSessionPreview(firstRec) || {};
  // Extract a user-facing snippet: most recent assistant text or user question.
  let snippet = '';
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
  const sessionId = preview.sessionId || fileName.replace(/\.jsonl$/, '');
  return {
    sessionId,
    filePath: fullPath,
    cwd: preview.cwd || decodeProjectDirName(path.basename(dirPath)),
    gitBranch: preview.gitBranch || null,
    startedAt: preview.timestamp || null,
    updatedAt: stat.mtime.toISOString(),
    sizeBytes: stat.size,
    snippet,
  };
}

// Claude encodes cwd into the projects/ dir name by replacing every
// non-alphanumeric char with '-'. The leading '/' of an absolute cwd becomes
// the leading '-' naturally — do NOT prepend an extra '-' (that would give
// '--home-...' which never matches the real '-home-...' dirs, silently
// breaking the cwd-match sort).
function projectEncodedName(cwd) {
  if (!cwd) return null;
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

// List local Claude Code sessions across every project. When `projectCwd`
// is supplied, sessions whose encoded project dir matches float to the top
// (secondary sort: mtime desc). Never filters — the picker always shows
// everything so the user can cross projects when the probe is uncertain.
async function listSessions({ projectsDir = PROJECTS_DIR, limit = SESSION_LIST_LIMIT, projectCwd = null } = {}) {
  const root = expandHome(projectsDir);
  const encoded = projectCwd ? projectEncodedName(projectCwd) : null;

  let projectDirs;
  try {
    projectDirs = fs.readdirSync(root).map((d) => ({ dirName: d, dir: path.join(root, d) }));
  } catch (err) {
    console.warn('[diff] listSessions readdir failed:', root, err && err.message);
    const e = new Error(`${err.code || 'error'}: ${err.message || String(err)} (${root})`);
    e.cause = err;
    e.path = root;
    throw e;
  }

  const candidates = [];
  for (const { dir, dirName } of projectDirs) {
    let files;
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const fullPath = path.join(dir, f);
      let stat;
      try { stat = fs.statSync(fullPath); } catch { continue; }
      if (!stat.isFile()) continue;
      candidates.push({ dir, dirName, file: f, mtimeMs: stat.mtimeMs });
    }
  }
  candidates.sort((a, b) => {
    const aMatch = encoded && a.dirName === encoded ? 0 : 1;
    const bMatch = encoded && b.dirName === encoded ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return b.mtimeMs - a.mtimeMs;
  });

  const top = candidates.slice(0, limit);
  const results = await Promise.all(top.map(({ dir, file }) => summarizeSessionFile(dir, file)));
  return results.filter(Boolean);
}

// Tail a session JSONL file. Returns a handle with a stop() method.
// `onRecord(record)` fires for each successfully parsed JSON record. `onError`
// receives fs errors that prevent further reading.
function watchSession(filePath, { onRecord, onError } = {}) {
  let cursor = 0;
  let closed = false;
  let pendingRead = false;
  let leftover = '';
  let watcher = null;

  const doRead = () => {
    if (closed || pendingRead) return;
    pendingRead = true;
    fs.stat(filePath, (err, stat) => {
      if (err) { pendingRead = false; if (onError) onError(err); return; }
      if (stat.size < cursor) {
        // Truncated/rotated — start over.
        cursor = 0;
        leftover = '';
      }
      if (stat.size === cursor) { pendingRead = false; return; }
      const readBytes = stat.size - cursor;
      const buf = Buffer.alloc(readBytes);
      fs.open(filePath, 'r', (oerr, fd) => {
        if (oerr) { pendingRead = false; if (onError) onError(oerr); return; }
        fs.read(fd, buf, 0, readBytes, cursor, (rerr, _n, result) => {
          fs.close(fd, () => {});
          pendingRead = false;
          if (rerr) { if (onError) onError(rerr); return; }
          cursor = stat.size;
          const chunk = leftover + result.toString('utf8');
          const { records, leftover: next } = parseLineBuffer(chunk);
          leftover = next;
          if (onRecord) for (const rec of records) onRecord(rec);
        });
      });
    });
  };

  try {
    watcher = fs.watch(filePath, { persistent: true }, (eventType) => {
      if (eventType === 'change') doRead();
      else if (eventType === 'rename') {
        // File may have been rotated — close watcher and retry in 1 s.
        if (watcher) watcher.close();
        setTimeout(() => {
          if (closed) return;
          cursor = 0; leftover = '';
          try { watcher = fs.watch(filePath, { persistent: true }, (et) => { if (et === 'change') doRead(); }); } catch {}
          doRead();
        }, 1000);
      }
    });
  } catch (e) {
    if (onError) onError(e);
  }
  // Initial catch-up read.
  doRead();

  return {
    stop() {
      closed = true;
      if (watcher) { try { watcher.close(); } catch {} watcher = null; }
    },
  };
}

module.exports = {
  PROJECTS_DIR,
  listSessions,
  watchSession,
  summarizeSessionFile,
  expandHome,
  decodeProjectDirName,
  projectEncodedName,
};

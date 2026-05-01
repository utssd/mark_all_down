// Plan file source: list and watch Claude Code plan-mode markdown files.
//
// Plans live at ~/.claude/plans/<slug>.md, one file per plan-mode session.
// The watcher debounces rapid writes (Claude rewrites the file on each edit).

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { EDIT_TOOL_NAMES } = require('./transcript');

const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans');
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const WATCH_DEBOUNCE_MS = 80;

// Mirror the encoding Claude Code uses for project-scoped session dirs under
// ~/.claude/projects/: every non-alphanumeric char is replaced with '-'. The
// leading '/' of an absolute cwd becomes the leading '-' naturally — do NOT
// prepend an extra '-' (Claude doesn't, and doing so gives '--home-...'
// which never matches the real '-home-...' dirs).
function projectEncodedName(cwd) {
  if (!cwd) return null;
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function extractPreview(md) {
  if (!md) return { heading: null, paragraph: null };
  const lines = md.split('\n');
  let heading = null;
  let paragraph = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
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

function readPreviewSync(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    return extractPreview(buf.slice(0, n).toString('utf8'));
  } catch {
    return { heading: null, paragraph: null };
  }
}

function listPlans({ plansDir = PLANS_DIR, projectsDir = PROJECTS_DIR, projectCwd = null } = {}) {
  const root = expandHome(plansDir);
  let entries;
  try {
    entries = fs.readdirSync(root);
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    console.warn('[plan] listPlans readdir failed:', root, err && err.message);
    const e = new Error(`${err.code || 'error'}: ${err.message || String(err)} (${root})`);
    e.cause = err;
    e.path = root;
    throw e;
  }
  const cwdScopedPaths = projectCwd
    ? collectPlanPathsForProjectCwd({ projectCwd, projectsDir, plansDir: root })
    : null;
  const results = [];
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(root, name);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isFile()) continue;
    const preview = readPreviewSync(full);
    results.push({
      path: full,
      name,
      slug: name.replace(/\.md$/, ''),
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
      mtime: stat.mtime.toISOString(),
      heading: preview.heading,
      paragraph: preview.paragraph,
      cwdMatch: cwdScopedPaths ? cwdScopedPaths.has(full) : false,
    });
  }
  results.sort((a, b) => {
    if (a.cwdMatch !== b.cwdMatch) return a.cwdMatch ? -1 : 1;
    return b.mtimeMs - a.mtimeMs;
  });
  return results;
}

// Collect every plan-file path authored by any session whose project dir
// matches `projectCwd`. Cheap scan of a single encoded project dir — no
// stat/preview work, just the set of paths. Used by listPlans to float
// cwd-matched plans to the top of the picker.
function collectPlanPathsForProjectCwd({ projectCwd, projectsDir = PROJECTS_DIR, plansDir = PLANS_DIR } = {}) {
  const result = new Set();
  const encoded = projectEncodedName(projectCwd);
  if (!encoded) return result;
  const resolvedProjects = expandHome(projectsDir);
  const projectDir = path.join(resolvedProjects, encoded);
  const resolvedPlansDir = expandHome(plansDir);
  const prefix = resolvedPlansDir.endsWith(path.sep) ? resolvedPlansDir : resolvedPlansDir + path.sep;
  let sessionFiles;
  try { sessionFiles = fs.readdirSync(projectDir); }
  catch { return result; }
  for (const name of sessionFiles) {
    if (!name.endsWith('.jsonl')) continue;
    const sessionPath = path.join(projectDir, name);
    let contents;
    try { contents = fs.readFileSync(sessionPath, 'utf8'); }
    catch { continue; }
    for (const line of contents.split('\n')) {
      if (!line) continue;
      let rec; try { rec = JSON.parse(line); } catch { continue; }
      const msg = rec && rec.message;
      const content = msg && Array.isArray(msg.content) ? msg.content : null;
      if (!content) continue;
      for (const c of content) {
        if (!c || c.type !== 'tool_use' || !EDIT_TOOL_NAMES.has(c.name)) continue;
        const fp = c.input && c.input.file_path;
        if (typeof fp === 'string' && fp.startsWith(prefix)) result.add(fp);
      }
    }
  }
  return result;
}

// Scan a Claude session JSONL for plan-mode writes. Returns plan records for
// plans authored in THIS session, newest-first by disk mtime. "Authored" =
// any Write/Edit/MultiEdit tool_use whose input.file_path is under plansDir.
// Multiple writes to the same plan collapse to one entry (de-duped by path).
function listPlansForSession({ sessionPath, plansDir = PLANS_DIR } = {}) {
  if (!sessionPath) return [];
  const resolvedPlansDir = expandHome(plansDir);
  const resolvedSession = expandHome(sessionPath);
  let contents;
  try { contents = fs.readFileSync(resolvedSession, 'utf8'); }
  catch (err) {
    if (err && err.code === 'ENOENT') return [];
    console.warn('[plan] listPlansForSession read failed:', resolvedSession, err && err.message);
    return [];
  }
  const seen = new Set();
  const prefix = resolvedPlansDir.endsWith(path.sep) ? resolvedPlansDir : resolvedPlansDir + path.sep;
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
  const out = [];
  for (const fp of seen) {
    let stat; try { stat = fs.statSync(fp); } catch { continue; }
    if (!stat.isFile()) continue;
    const name = path.basename(fp);
    const preview = readPreviewSync(fp);
    out.push({
      path: fp,
      name,
      slug: name.replace(/\.md$/, ''),
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
      mtime: stat.mtime.toISOString(),
      heading: preview.heading,
      paragraph: preview.paragraph,
    });
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

function readPlan(filePath) {
  return fs.promises.readFile(expandHome(filePath), 'utf8');
}

// Watch a single plan file. onChange fires with { content, mtime } after
// writes settle (debounced). onError fires on fs errors. onRemoved fires when
// the file is deleted/renamed.
function watchPlan(filePath, { onChange, onError, onRemoved } = {}) {
  const resolved = expandHome(filePath);
  let closed = false;
  let watcher = null;
  let debounceTimer = null;

  const fire = async () => {
    debounceTimer = null;
    if (closed) return;
    try {
      const stat = await fs.promises.stat(resolved);
      const content = await fs.promises.readFile(resolved, 'utf8');
      if (onChange) onChange({ content, mtime: stat.mtime.toISOString() });
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        if (onRemoved) onRemoved();
        return;
      }
      if (onError) onError(err);
    }
  };

  const schedule = () => {
    if (closed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fire, WATCH_DEBOUNCE_MS);
  };

  try {
    watcher = fs.watch(resolved, { persistent: true }, (eventType) => {
      if (closed) return;
      if (eventType === 'change') {
        schedule();
      } else if (eventType === 'rename') {
        // File may have been rotated or deleted. Check if it still exists.
        fs.stat(resolved, (err) => {
          if (err) {
            if (onRemoved) onRemoved();
          } else {
            if (watcher) { try { watcher.close(); } catch {} }
            try {
              watcher = fs.watch(resolved, { persistent: true }, (et) => {
                if (!closed && et === 'change') schedule();
              });
            } catch (e) { if (onError) onError(e); }
            schedule();
          }
        });
      }
    });
  } catch (err) {
    if (onError) onError(err);
  }

  return {
    stop() {
      closed = true;
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      if (watcher) { try { watcher.close(); } catch {} watcher = null; }
    },
  };
}

module.exports = {
  PLANS_DIR,
  PROJECTS_DIR,
  projectEncodedName,
  collectPlanPathsForProjectCwd,
  listPlans,
  listPlansForSession,
  readPlan,
  watchPlan,
  expandHome,
};

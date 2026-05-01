// Per-file change aggregator.
//
// Ingests FileChange records produced by transcript.js. Because the current
// Claude Code transcript schema usually leaves `originalFile` null on Edit
// tool_results (even though `structuredPatch` is populated), we can't always
// compute a true net diff between the session baseline and current content.
//
// Strategy:
//   - When baseline is captured (first change has non-null originalFile) and the
//     file has multiple edits, compute a merged net diff from baseline → working.
//   - Otherwise, render the per-edit structuredPatch(es) directly. Multi-edit
//     files show concatenated patches sorted by edit order; each edit's hunks
//     are self-contained against its own (intermediate) baseline, which is
//     sufficient for reviewing what changed.
//
// Both paths produce hunks in the same shape Claude itself uses — the viewer
// doesn't need to distinguish.

'use strict';

const { diffToHunks } = require('./lineDiff');

const SIZE_TIER_HOLD = 2 * 1024 * 1024;   // baseline + working kept + re-diffed
const SIZE_TIER_DROP = 10 * 1024 * 1024;  // above: badge only

function classifyTier(bytes) {
  if (bytes > SIZE_TIER_DROP) return 'drop';
  if (bytes > SIZE_TIER_HOLD) return 'lazy';
  return 'hold';
}

function countAddsDels(hunks) {
  let adds = 0, dels = 0;
  for (const h of hunks) {
    for (const l of h.lines) {
      if (l.length === 0) continue;
      if (l[0] === '+') adds++;
      else if (l[0] === '-') dels++;
    }
  }
  return { adds, dels };
}

// Apply a single hunk to an array of lines, producing a new array.
// Assumes hunk.oldStart is 1-indexed and hunk.oldLines matches the ' '/'-' lines.
function applyHunk(lines, hunk) {
  const before = lines.slice(0, hunk.oldStart - 1);
  const after = lines.slice(hunk.oldStart - 1 + hunk.oldLines);
  const middle = [];
  for (const l of hunk.lines) {
    if (!l.length) { middle.push(''); continue; }
    const marker = l[0];
    const body = l.slice(1);
    if (marker === ' ' || marker === '+') middle.push(body);
  }
  return before.concat(middle, after);
}

function applyPatch(lines, structuredPatch) {
  if (!structuredPatch || !structuredPatch.length) return lines;
  const sorted = structuredPatch.slice().sort((a, b) => a.oldStart - b.oldStart);
  let out = lines;
  for (let i = sorted.length - 1; i >= 0; i--) {
    out = applyHunk(out, sorted[i]);
  }
  return out;
}

function createState() {
  return {
    files: new Map(),
    lastUpdatedAt: null,
  };
}

// FileEntry:
// {
//   filePath, status ('added' | 'modified'), tier ('hold' | 'drop'),
//   baseline: string | null,           // captured on first sighting if originalFile != null
//   workingLines: string[] | null,     // maintained only when baseline known
//   changes: FileChange[],             // for provenance + per-edit display
//   cached: { hunks, toolUseId, adds, dels } | null,
// }

function ensureEntry(state, filePath) {
  let entry = state.files.get(filePath);
  if (!entry) {
    entry = {
      filePath,
      status: 'modified',
      tier: 'hold',
      baseline: null,
      workingLines: null,
      changes: [],
      cached: null,
    };
    state.files.set(filePath, entry);
  }
  return entry;
}

function ingest(state, change) {
  const entry = ensureEntry(state, change.filePath);
  entry.changes.push(change);
  if (change.timestamp) state.lastUpdatedAt = change.timestamp;
  entry.cached = null;

  if (entry.changes.length === 1) {
    // First change — set status + maybe baseline.
    if (change.isCreate) {
      entry.status = 'added';
      entry.baseline = '';
      if (typeof change.newContent === 'string') {
        entry.workingLines = change.newContent.split('\n');
      }
    } else if (typeof change.originalFile === 'string') {
      entry.baseline = change.originalFile;
      entry.tier = classifyTier(Buffer.byteLength(entry.baseline, 'utf8'));
      if (entry.tier !== 'drop') {
        entry.workingLines = entry.baseline.split('\n');
        entry.workingLines = applyPatch(entry.workingLines, change.structuredPatch);
      }
    }
    // If originalFile is null and not a create, we have no baseline — that's OK;
    // we'll render per-edit patches directly.
    return;
  }

  // Subsequent change — maintain workingLines if we have a baseline.
  if (entry.workingLines && entry.tier !== 'drop') {
    if (change.isCreate && typeof change.newContent === 'string') {
      entry.workingLines = change.newContent.split('\n');
    } else {
      entry.workingLines = applyPatch(entry.workingLines, change.structuredPatch);
    }
  }
}

function latestToolUseId(entry) {
  if (!entry.changes.length) return null;
  return entry.changes[entry.changes.length - 1].toolUseId;
}

// Concatenate per-edit hunks, with a synthetic "edit header" hunk between
// successive edits when there are multiple. We do this by simply emitting all
// hunks in order — the viewer can group by edit via the toolUseId tag.
function concatenatePerEditHunks(entry) {
  const out = [];
  for (let i = 0; i < entry.changes.length; i++) {
    const ch = entry.changes[i];
    for (const h of ch.structuredPatch) {
      out.push(Object.assign({}, h, {
        editIndex: i,
        editCount: entry.changes.length,
        toolUseId: ch.toolUseId,
        timestamp: ch.timestamp,
      }));
    }
  }
  return out;
}

function computeHunks(entry) {
  const useId = latestToolUseId(entry);
  if (entry.cached && entry.cached.toolUseId === useId) return entry.cached;

  let hunks = [];
  let mode = 'per-edit';

  if (entry.tier === 'drop') {
    hunks = [];
    mode = 'oversized';
  } else if (entry.status === 'added' && entry.workingLines) {
    const nonEmpty = entry.workingLines.filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === ''));
    const lines = nonEmpty.map(l => '+' + l);
    if (lines.length) {
      hunks = [{
        oldStart: 0, oldLines: 0,
        newStart: 1, newLines: nonEmpty.length,
        lines,
      }];
    }
    mode = 'added';
  } else if (entry.changes.length === 1) {
    // Single edit — use Claude's own patch verbatim.
    hunks = entry.changes[0].structuredPatch.map(h => Object.assign({}, h, {
      editIndex: 0, editCount: 1,
      toolUseId: entry.changes[0].toolUseId,
      timestamp: entry.changes[0].timestamp,
    }));
    mode = 'single-edit';
  } else if (entry.baseline !== null && entry.workingLines && entry.tier !== 'drop') {
    // Multi-edit with known baseline → compute true net diff.
    const working = entry.workingLines.join('\n');
    hunks = diffToHunks(entry.baseline, working, 3);
    mode = 'net-diff';
  } else {
    // Multi-edit without baseline → show per-edit concatenation.
    hunks = concatenatePerEditHunks(entry);
    mode = 'per-edit';
  }

  const { adds, dels } = countAddsDels(hunks);
  entry.cached = { hunks, toolUseId: useId, adds, dels, mode };
  return entry.cached;
}

function snapshot(state) {
  const files = [];
  for (const entry of state.files.values()) {
    const cached = computeHunks(entry);
    files.push({
      filePath: entry.filePath,
      status: entry.status,
      tier: entry.tier,
      adds: cached.adds,
      dels: cached.dels,
      editCount: entry.changes.length,
      mode: cached.mode,
    });
  }
  files.sort((a, b) => {
    const ea = state.files.get(a.filePath);
    const eb = state.files.get(b.filePath);
    const ta = ea.changes[ea.changes.length - 1]?.timestamp || '';
    const tb = eb.changes[eb.changes.length - 1]?.timestamp || '';
    return tb.localeCompare(ta);
  });
  return { files, updatedAt: state.lastUpdatedAt };
}

function getHunks(state, filePath) {
  const entry = state.files.get(filePath);
  if (!entry) return null;
  const cached = computeHunks(entry);
  return {
    filePath,
    status: entry.status,
    tier: entry.tier,
    hunks: cached.hunks,
    editCount: entry.changes.length,
    mode: cached.mode,
    baselineAvailable: entry.baseline !== null,
  };
}

module.exports = {
  createState,
  ingest,
  snapshot,
  getHunks,
  applyPatch,
  SIZE_TIER_HOLD,
  SIZE_TIER_DROP,
};

// Latest editing-round aggregator.
//
// A "round" is everything Claude did in response to one user prompt — spanning
// however many assistant records that takes. The caller (main.js) stamps each
// FileChange with a `turnId` derived from the most recent user-prompt record's
// uuid, so `ingest` treats a new user prompt as the boundary that wipes state
// and starts a fresh round. Within a round, re-edits to the same file replace
// that file's hunks (MultiEdit already emits a merged structuredPatch).
//
// Unlike sessionState.js (which tracks net diff from the session baseline),
// turnState holds only the files touched in the current round.
//
// Hunks come directly from Claude's own tool_result.structuredPatch — no
// diffing work needed on our side.

'use strict';

const SIZE_TIER_HOLD = 2 * 1024 * 1024;
const SIZE_TIER_DROP = 10 * 1024 * 1024;

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

function createState() {
  return {
    turnId: null,
    turnStartedAt: null,
    edits: [],          // Array<FileEdit> — preserves discovery order per turn
    byPath: new Map(),  // filePath -> index into edits
    lastUpdatedAt: null,
  };
}

// FileEdit shape:
// {
//   filePath, status ('added' | 'modified'), tier,
//   hunks, adds, dels, kind, toolUseId, timestamp, editIndex,
// }

function buildHunksFromChange(change) {
  // Write that creates a new file → synthesize a single + hunk from newContent.
  if (change.isCreate) {
    const content = typeof change.newContent === 'string' ? change.newContent : '';
    if (!content) return [];
    const lines = content.split('\n');
    const trimmed = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
    if (!trimmed.length) return [];
    return [{
      oldStart: 0, oldLines: 0,
      newStart: 1, newLines: trimmed.length,
      lines: trimmed.map(l => '+' + l),
      editIndex: 0, editCount: 1,
      toolUseId: change.toolUseId,
      timestamp: change.timestamp,
    }];
  }
  // Regular edit → take structuredPatch verbatim.
  return (change.structuredPatch || []).map(h => Object.assign({}, h, {
    editIndex: 0, editCount: 1,
    toolUseId: change.toolUseId,
    timestamp: change.timestamp,
  }));
}

function deriveStatus(change) {
  return change.isCreate ? 'added' : 'modified';
}

function deriveTier(change) {
  if (typeof change.originalFile === 'string') {
    return classifyTier(Buffer.byteLength(change.originalFile, 'utf8'));
  }
  if (change.isCreate && typeof change.newContent === 'string') {
    return classifyTier(Buffer.byteLength(change.newContent, 'utf8'));
  }
  return 'hold';
}

// Ingest one FileChange. Returns { turnChanged, filePath, editIndex, fileAdded }.
// Caller uses this to decide precisely what to push to the renderer.
function ingest(state, change) {
  const turnId = change.turnId || null;
  let turnChanged = false;

  if (turnId !== state.turnId) {
    state.turnId = turnId;
    state.turnStartedAt = change.timestamp || null;
    state.edits = [];
    state.byPath = new Map();
    turnChanged = true;
  }

  const hunks = buildHunksFromChange(change);
  const { adds, dels } = countAddsDels(hunks);
  const status = deriveStatus(change);
  const tier = deriveTier(change);

  let editIndex;
  let fileAdded = false;
  const existing = state.byPath.get(change.filePath);
  if (existing !== undefined) {
    editIndex = existing;
    const prev = state.edits[existing];
    state.edits[existing] = {
      filePath: change.filePath,
      status: prev.status === 'added' ? 'added' : status,
      tier,
      hunks, adds, dels,
      kind: change.kind || 'edit',
      toolUseId: change.toolUseId,
      timestamp: change.timestamp || null,
      editIndex: existing,
    };
  } else {
    editIndex = state.edits.length;
    state.edits.push({
      filePath: change.filePath,
      status, tier,
      hunks, adds, dels,
      kind: change.kind || 'edit',
      toolUseId: change.toolUseId,
      timestamp: change.timestamp || null,
      editIndex,
    });
    state.byPath.set(change.filePath, editIndex);
    fileAdded = true;
  }

  if (change.timestamp) state.lastUpdatedAt = change.timestamp;

  return { turnChanged, filePath: change.filePath, editIndex, fileAdded };
}

function snapshot(state) {
  const files = state.edits.map(e => ({
    filePath: e.filePath,
    status: e.status,
    tier: e.tier,
    adds: e.adds,
    dels: e.dels,
    kind: e.kind,
    editIndex: e.editIndex,
    timestamp: e.timestamp,
  }));
  return {
    turnId: state.turnId,
    turnStartedAt: state.turnStartedAt,
    updatedAt: state.lastUpdatedAt,
    files,
  };
}

function getHunks(state, filePath) {
  const idx = state.byPath.get(filePath);
  if (idx === undefined) return null;
  const e = state.edits[idx];
  return {
    filePath: e.filePath,
    status: e.status,
    tier: e.tier,
    hunks: e.hunks,
    editIndex: e.editIndex,
    kind: e.kind,
  };
}

module.exports = {
  createState,
  ingest,
  snapshot,
  getHunks,
  SIZE_TIER_HOLD,
  SIZE_TIER_DROP,
};

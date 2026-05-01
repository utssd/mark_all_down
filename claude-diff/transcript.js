// Claude Code transcript JSONL parser.
//
// Consumes line-delimited records from ~/.claude/projects/<cwd>/<session>.jsonl and
// emits normalized FileChange entries for Edit / Write / MultiEdit / NotebookEdit
// tool calls that produced a non-error tool_result.
//
// Design: single source of truth = tool_result.toolUseResult. originalFile and
// structuredPatch are taken verbatim; no text-diff library is used.

'use strict';

const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const CHEAP_FILTER_HINTS = ['"tool_use"', '"tool_result"'];

function safeParseLine(line) {
  try {
    return JSON.parse(line);
  } catch (_err) {
    return null;
  }
}

// Fast pre-filter: most transcript lines are prose/thinking and can be skipped
// without paying the JSON.parse cost.
function lineLooksInteresting(line) {
  for (const hint of CHEAP_FILTER_HINTS) {
    if (line.indexOf(hint) !== -1) return true;
  }
  return false;
}

function isArray(x) { return Array.isArray(x); }

function extractToolUse(record) {
  if (!record || record.type !== 'assistant') return null;
  const content = record.message && record.message.content;
  if (!isArray(content)) return null;
  const uses = [];
  const turnId = record.uuid || null;
  for (const c of content) {
    if (c && c.type === 'tool_use' && EDIT_TOOL_NAMES.has(c.name)) {
      uses.push({
        id: c.id,
        name: c.name,
        input: c.input || {},
        timestamp: record.timestamp || null,
        turnId,
      });
    }
  }
  return uses.length ? uses : null;
}

function extractToolResult(record) {
  if (!record || record.type !== 'user') return null;
  const content = record.message && record.message.content;
  if (!isArray(content)) return null;
  const results = [];
  for (const c of content) {
    if (c && c.type === 'tool_result') {
      results.push({
        id: c.tool_use_id,
        isError: c.is_error === true,
        // toolUseResult lives on the outer record, not inside the content item
        toolUseResult: record.toolUseResult || null,
        timestamp: record.timestamp || null,
      });
    }
  }
  return results.length ? results : null;
}

// True when a record represents a real human prompt (not a tool_result carrier
// and not a sidechain subagent message). Used to mark editing-round boundaries:
// a "round" is everything Claude did in response to one human message, spanning
// however many assistant records that takes.
function isUserPromptRecord(record) {
  if (!record || record.type !== 'user') return false;
  if (record.isSidechain === true) return false;
  const content = record.message && record.message.content;
  if (typeof content === 'string') return content.length > 0;
  if (!isArray(content)) return false;
  let hasNonToolResult = false;
  for (const c of content) {
    if (!c) continue;
    if (c.type !== 'tool_result') { hasNonToolResult = true; break; }
  }
  return hasNonToolResult;
}

function kindFromToolName(name) {
  switch (name) {
    case 'Edit': return 'edit';
    case 'Write': return 'write';
    case 'MultiEdit': return 'multiedit';
    case 'NotebookEdit': return 'notebook';
    default: return 'edit';
  }
}

// Normalize a matched pair into FileChange records. Most pairs produce a single
// change; only NotebookEdit may in theory produce more (we keep the interface
// array-returning to leave room).
function extractChange(pair) {
  const { toolUse, toolResult } = pair;
  if (!toolResult || toolResult.isError) return [];
  const tur = toolResult.toolUseResult;
  if (!tur || typeof tur !== 'object') return [];

  const filePath = tur.filePath || (toolUse && toolUse.input && toolUse.input.file_path) || null;
  if (!filePath) return [];

  const structuredPatch = isArray(tur.structuredPatch) ? tur.structuredPatch : [];
  const originalFile = typeof tur.originalFile === 'string' ? tur.originalFile : null;
  // Write type 'create' implies a new file. Some records also carry tur.type === 'create'.
  const writeKind = toolUse && toolUse.name === 'Write';
  const writeType = tur.type || null;
  const isCreate = writeKind && (writeType === 'create' || (originalFile === null && structuredPatch.length === 0));

  return [{
    filePath,
    kind: kindFromToolName(toolUse.name),
    originalFile,
    newContent: typeof tur.content === 'string' ? tur.content : null, // Write full content, useful for 'create'
    structuredPatch,
    isCreate,
    userModified: tur.userModified === true,
    toolUseId: toolUse.id,
    turnId: toolUse.turnId || null,
    timestamp: toolResult.timestamp || toolUse.timestamp || null,
  }];
}

// Stateful pair-matcher. Feed in records (either tool_use or tool_result carriers)
// and emits { toolUse, toolResult } pairs once both sides are seen.
//
// Usage:
//   const matcher = createPairMatcher();
//   for await (const record of parseJsonlStream(stream)) {
//     for (const pair of matcher.push(record)) { ... }
//   }
class PairMatcher {
  constructor() {
    this._pendingUses = new Map();     // id -> toolUse
    this._pendingResults = new Map();  // id -> toolResult (rare: result before use)
  }

  push(record) {
    const pairs = [];
    const uses = extractToolUse(record);
    if (uses) {
      for (const u of uses) {
        if (this._pendingResults.has(u.id)) {
          pairs.push({ toolUse: u, toolResult: this._pendingResults.get(u.id) });
          this._pendingResults.delete(u.id);
        } else {
          this._pendingUses.set(u.id, u);
        }
      }
    }
    const results = extractToolResult(record);
    if (results) {
      for (const r of results) {
        if (this._pendingUses.has(r.id)) {
          pairs.push({ toolUse: this._pendingUses.get(r.id), toolResult: r });
          this._pendingUses.delete(r.id);
        } else {
          this._pendingResults.set(r.id, r);
        }
      }
    }
    return pairs;
  }

  pendingUseIds() { return Array.from(this._pendingUses.keys()); }
}

function createPairMatcher() {
  return new PairMatcher();
}

// Parse a buffer of line-delimited JSON into records. Returns { records, leftover }
// where leftover is a trailing partial line to carry over to the next buffer.
function parseLineBuffer(buf) {
  const records = [];
  const lines = buf.split('\n');
  const leftover = lines.pop(); // may be empty (if buf ended on \n) or partial line
  for (const line of lines) {
    if (!line || !lineLooksInteresting(line)) continue;
    const rec = safeParseLine(line);
    if (rec) records.push(rec);
  }
  return { records, leftover: leftover || '' };
}

// Read the first record of a session file cheaply, for picker previews.
function extractSessionPreview(firstRecord) {
  if (!firstRecord) return null;
  return {
    sessionId: firstRecord.sessionId || null,
    cwd: firstRecord.cwd || null,
    gitBranch: firstRecord.gitBranch || null,
    timestamp: firstRecord.timestamp || null,
    version: firstRecord.version || null,
  };
}

module.exports = {
  EDIT_TOOL_NAMES,
  parseLineBuffer,
  lineLooksInteresting,
  safeParseLine,
  extractToolUse,
  extractToolResult,
  isUserPromptRecord,
  extractChange,
  createPairMatcher,
  extractSessionPreview,
};

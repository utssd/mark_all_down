// Minimal line-based diff used only when we need to compute "net change"
// between the session baseline and current working content — i.e. when a
// file has been edited multiple times in one session.
//
// Algorithm: strip common prefix/suffix, then Myers-style shortest-edit-script
// on the inner region. Common-prefix stripping keeps the inner region small for
// the usual case (localized code edits), so the O((N+M)*D) Myers core stays cheap.
//
// Output: array of { kind: 'ctx'|'add'|'del', line: string, oldLn?: number, newLn?: number }
// which callers can group into unified-diff hunks.

'use strict';

function shortestEditScript(a, b) {
  // Myers 1986 — walk the edit graph by increasing D (edit distance) until
  // we touch the far corner. V maps k-diagonal -> furthest-reaching x.
  const N = a.length, M = b.length;
  if (N === 0 && M === 0) return [];
  if (N === 0) return b.map((line, i) => ({ kind: 'add', line, newIdx: i }));
  if (M === 0) return a.map((line, i) => ({ kind: 'del', line, oldIdx: i }));
  const max = N + M;
  const v = new Array(2 * max + 1);
  const offset = max;
  v[offset + 1] = 0;
  const trace = [];
  let found = false, finalD = -1;
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]; // down
      } else {
        x = v[offset + k - 1] + 1; // right
      }
      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= N && y >= M) { found = true; finalD = d; break; }
    }
    if (found) break;
  }
  if (!found) {
    // shouldn't happen but fall back to a crude diff
    return [
      ...a.map((line, i) => ({ kind: 'del', line, oldIdx: i })),
      ...b.map((line, i) => ({ kind: 'add', line, newIdx: i })),
    ];
  }
  // Backtrack through traces.
  const edits = [];
  let x = N, y = M;
  for (let d = finalD; d > 0; d--) {
    const vPrev = trace[d];
    const k = x - y;
    let prevK;
    if (k === -d || (k !== d && vPrev[offset + k - 1] < vPrev[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vPrev[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      edits.push({ kind: 'ctx', line: a[x - 1], oldIdx: x - 1, newIdx: y - 1 });
      x--; y--;
    }
    if (x > prevX) { edits.push({ kind: 'del', line: a[x - 1], oldIdx: x - 1 }); x--; }
    else if (y > prevY) { edits.push({ kind: 'add', line: b[y - 1], newIdx: y - 1 }); y--; }
  }
  while (x > 0 && y > 0) {
    edits.push({ kind: 'ctx', line: a[x - 1], oldIdx: x - 1, newIdx: y - 1 });
    x--; y--;
  }
  while (x > 0) { edits.push({ kind: 'del', line: a[x - 1], oldIdx: x - 1 }); x--; }
  while (y > 0) { edits.push({ kind: 'add', line: b[y - 1], newIdx: y - 1 }); y--; }
  return edits.reverse();
}

function diffLines(oldText, newText) {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  // Strip common prefix.
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  // Strip common suffix.
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) suffix++;
  const innerA = a.slice(prefix, a.length - suffix);
  const innerB = b.slice(prefix, b.length - suffix);
  const inner = shortestEditScript(innerA, innerB);
  // Re-anchor oldIdx/newIdx to whole-file line numbers.
  const out = [];
  for (let i = 0; i < prefix; i++) out.push({ kind: 'ctx', line: a[i], oldIdx: i, newIdx: i });
  for (const e of inner) {
    const entry = { kind: e.kind, line: e.line };
    if (e.oldIdx !== undefined) entry.oldIdx = prefix + e.oldIdx;
    if (e.newIdx !== undefined) entry.newIdx = prefix + e.newIdx;
    out.push(entry);
  }
  for (let i = 0; i < suffix; i++) {
    out.push({
      kind: 'ctx',
      line: a[a.length - suffix + i],
      oldIdx: a.length - suffix + i,
      newIdx: b.length - suffix + i,
    });
  }
  return out;
}

// Group a flat edit script into unified-diff hunks with `contextLines` of
// surrounding context. Returns [{ oldStart, oldLines, newStart, newLines, lines }]
// where lines uses the same " ctx" / "-del" / "+add" prefix convention as
// Claude's own structuredPatch output, so downstream rendering is uniform.
function scriptToHunks(script, contextLines) {
  const ctx = contextLines == null ? 3 : contextLines;
  const hunks = [];
  let i = 0;
  while (i < script.length) {
    if (script[i].kind === 'ctx') { i++; continue; }
    // Found a change — expand backward for context.
    const start = Math.max(0, i - ctx);
    let end = i + 1;
    while (end < script.length) {
      if (script[end].kind !== 'ctx') { end++; continue; }
      // Is there another change within `ctx` lines?
      let nextChange = -1;
      for (let j = end; j < Math.min(script.length, end + ctx * 2 + 1); j++) {
        if (script[j].kind !== 'ctx') { nextChange = j; break; }
      }
      if (nextChange !== -1 && nextChange - end < ctx * 2) {
        end = nextChange + 1;
      } else {
        end = Math.min(script.length, end + ctx);
        break;
      }
    }
    const block = script.slice(start, end);
    // Compute hunk headers.
    let oldStart = null, newStart = null, oldLines = 0, newLines = 0;
    const lines = [];
    for (const e of block) {
      if (e.kind === 'ctx') {
        if (oldStart == null) oldStart = e.oldIdx + 1;
        if (newStart == null) newStart = e.newIdx + 1;
        oldLines++; newLines++;
        lines.push(' ' + e.line);
      } else if (e.kind === 'del') {
        if (oldStart == null) oldStart = e.oldIdx + 1;
        if (newStart == null) newStart = (newLines + (newStart || 1));
        oldLines++;
        lines.push('-' + e.line);
      } else if (e.kind === 'add') {
        if (newStart == null) newStart = e.newIdx + 1;
        if (oldStart == null) oldStart = (oldLines + (oldStart || 1));
        newLines++;
        lines.push('+' + e.line);
      }
    }
    hunks.push({
      oldStart: oldStart || 1,
      oldLines,
      newStart: newStart || 1,
      newLines,
      lines,
    });
    i = end;
  }
  return hunks;
}

function diffToHunks(oldText, newText, contextLines) {
  return scriptToHunks(diffLines(oldText, newText), contextLines);
}

module.exports = {
  diffLines,
  scriptToHunks,
  diffToHunks,
};

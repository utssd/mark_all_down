'use strict';

// Bounded per-PTY output ring buffer + attach state. A PTY keeps running (and
// its recent output accumulating here) while the renderer is gone — e.g. across
// a GPU-banner window reload — so the rebuilt renderer can replay the backlog
// and reattach instead of the shell being killed and the user's work lost.
// Pure/Electron-free so it is unit-testable; main.js owns the Map of entries.

const MAX_BUF_BYTES = 1024 * 1024; // ~1 MB of recent output retained per PTY

// attached=true means a live renderer is listening, so main streams output to
// it directly; while detached, output only accumulates in `buf`.
function createBufferEntry(label) {
  return { buf: [], bufBytes: 0, attached: true, label: label || null };
}

// Append a chunk, then drop whole chunks off the front until total bytes are
// within maxBytes. Bytes are measured as UTF-8 so multibyte output is counted
// correctly. A single chunk larger than the cap is kept whole (length > 1
// guard) and self-corrects as more output arrives.
function appendToRing(entry, data, maxBytes = MAX_BUF_BYTES) {
  entry.buf.push(data);
  entry.bufBytes += Buffer.byteLength(data, 'utf8');
  while (entry.bufBytes > maxBytes && entry.buf.length > 1) {
    const dropped = entry.buf.shift();
    entry.bufBytes -= Buffer.byteLength(dropped, 'utf8');
  }
  return entry;
}

// Return all buffered output as one string and reset the buffer. Called when a
// renderer attaches: the result is replayed into xterm; clearing it prevents
// the next live chunk from being written twice.
function drainBuffer(entry) {
  const out = entry.buf.join('');
  entry.buf = [];
  entry.bufBytes = 0;
  return out;
}

module.exports = { MAX_BUF_BYTES, createBufferEntry, appendToRing, drainBuffer };

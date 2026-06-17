// Pure helpers for the Open-File-by-Path viewer: resolve a user-entered path
// (relative or absolute) against a working directory, classify the file type,
// and sniff for binary content. No filesystem or DOM access — unit-testable.

'use strict';

const path = require('path');

// Mirror app.js classifyFileType: .md/.markdown/.txt render as markdown.
const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.txt']);
// Image extensions rendered inline (SVG included — it renders as an image).
const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.jpe', '.jfif', '.gif', '.webp', '.bmp', '.ico', '.svg',
]);
// HTML files render in a sandboxed iframe.
const HTML_EXTS = new Set(['.html', '.htm']);

function classifyViewerFileType(filePath) {
  const i = String(filePath).lastIndexOf('.');
  const ext = i >= 0 ? String(filePath).slice(i).toLowerCase() : '';
  if (ext === '.pdf') return 'pdf';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (HTML_EXTS.has(ext)) return 'html';
  if (MARKDOWN_EXTS.has(ext)) return 'markdown';
  return 'plaintext';
}

// Resolve `inputPath` against `cwd`. Remote hosts are POSIX, so remote paths
// use path.posix; local paths use the host's path module.
function resolveViewerPath({ inputPath, cwd, isRemote }) {
  const p = (inputPath == null ? '' : String(inputPath)).trim();
  if (!p) throw new Error('Path is required.');
  const pp = isRemote ? path.posix : path;
  if (pp.isAbsolute(p)) return pp.normalize(p);
  if (!cwd) {
    throw new Error(
      'Relative path needs a working directory, but none was detected. ' +
      'Use an absolute path, or open the file from a terminal where Claude is running.',
    );
  }
  return pp.normalize(pp.join(cwd, p));
}

// Heuristic: a NUL byte in the head means "not a text file".
function looksBinary(sample) {
  if (sample == null) return false;
  if (Buffer.isBuffer(sample)) {
    const n = Math.min(sample.length, 8000);
    for (let i = 0; i < n; i++) if (sample[i] === 0) return true;
    return false;
  }
  const s = String(sample);
  const n = Math.min(s.length, 8000);
  for (let i = 0; i < n; i++) if (s.charCodeAt(i) === 0) return true;
  return false;
}

module.exports = { classifyViewerFileType, resolveViewerPath, looksBinary, IMAGE_EXTS };

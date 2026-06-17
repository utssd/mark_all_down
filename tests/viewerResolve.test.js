// Unit tests for claude-diff/viewerResolve.js — pure path/type/binary helpers
// used by the Open-File-by-Path viewer. No I/O, no DOM.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveViewerPath,
  classifyViewerFileType,
  looksBinary,
} = require('../claude-diff/viewerResolve');

test('absolute local path is normalized and returned as-is', () => {
  assert.equal(
    resolveViewerPath({ inputPath: '/srv/work/a/../b.md', cwd: '/home/me', isRemote: false }),
    '/srv/work/b.md',
  );
});

test('relative local path joins against cwd', () => {
  assert.equal(
    resolveViewerPath({ inputPath: 'docs/r.md', cwd: '/home/me/proj', isRemote: false }),
    '/home/me/proj/docs/r.md',
  );
});

test('relative remote path uses POSIX join against remote cwd', () => {
  assert.equal(
    resolveViewerPath({ inputPath: 'docs/r.md', cwd: '/srv/work', isRemote: true }),
    '/srv/work/docs/r.md',
  );
});

test('absolute remote path is normalized with POSIX semantics', () => {
  assert.equal(
    resolveViewerPath({ inputPath: '/var/log/./x.log', cwd: '/srv/work', isRemote: true }),
    '/var/log/x.log',
  );
});

test('relative path without cwd throws a helpful error', () => {
  assert.throws(
    () => resolveViewerPath({ inputPath: 'docs/r.md', cwd: null, isRemote: false }),
    /working directory/i,
  );
});

test('empty path throws', () => {
  assert.throws(() => resolveViewerPath({ inputPath: '   ', cwd: '/x', isRemote: false }), /required/i);
});

test('classifyViewerFileType maps extensions', () => {
  assert.equal(classifyViewerFileType('/a/b.md'), 'markdown');
  assert.equal(classifyViewerFileType('/a/b.markdown'), 'markdown');
  assert.equal(classifyViewerFileType('/a/b.txt'), 'markdown');
  assert.equal(classifyViewerFileType('/a/b.py'), 'plaintext');
  assert.equal(classifyViewerFileType('/a/b.json'), 'plaintext');
  assert.equal(classifyViewerFileType('/a/NOEXT'), 'plaintext');
  assert.equal(classifyViewerFileType('/a/b.pdf'), 'pdf');
});

test('classifyViewerFileType maps images and html', () => {
  assert.equal(classifyViewerFileType('/a/b.png'), 'image');
  assert.equal(classifyViewerFileType('/a/b.JPG'), 'image'); // case-insensitive
  assert.equal(classifyViewerFileType('/a/b.jpeg'), 'image');
  assert.equal(classifyViewerFileType('/a/b.gif'), 'image');
  assert.equal(classifyViewerFileType('/a/b.webp'), 'image');
  assert.equal(classifyViewerFileType('/a/b.svg'), 'image'); // SVG renders as image
  assert.equal(classifyViewerFileType('/a/b.html'), 'html');
  assert.equal(classifyViewerFileType('/a/b.htm'), 'html');
  // unchanged classifications still hold
  assert.equal(classifyViewerFileType('/a/b.md'), 'markdown');
  assert.equal(classifyViewerFileType('/a/b.py'), 'plaintext');
});

test('looksBinary detects NUL bytes in Buffer and string', () => {
  assert.equal(looksBinary(Buffer.from([0x68, 0x69, 0x00, 0x21])), true);
  assert.equal(looksBinary(Buffer.from('hello world', 'utf-8')), false);
  assert.equal(looksBinary('plain text'), false);
  assert.equal(looksBinary('has' + String.fromCharCode(0) + 'nul'), true);
  assert.equal(looksBinary(null), false);
});

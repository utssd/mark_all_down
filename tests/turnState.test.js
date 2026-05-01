// Unit tests for claude-diff/turnState.js.
//
// Core invariants:
//   • New turnId resets the edit set.
//   • Same turnId + same filePath replaces hunks in place.
//   • Same turnId + new filePath appends.
//   • Write (isCreate) yields status='added' with a + hunk.
//   • snapshot + getHunks reflect the current state.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createState, ingest, snapshot, getHunks } = require('../claude-diff/turnState');

function patch(startOld, oldLines, startNew, newLines, plus = [], minus = []) {
  const lines = [...minus.map(l => '-' + l), ...plus.map(l => '+' + l)];
  return [{ oldStart: startOld, oldLines, newStart: startNew, newLines, lines }];
}

test('new turnId resets the edit set', () => {
  const s = createState();
  ingest(s, { turnId: 'T1', filePath: '/a.js', structuredPatch: patch(1, 0, 1, 1, ['hi']), toolUseId: 'u1', timestamp: 't0' });
  ingest(s, { turnId: 'T1', filePath: '/b.js', structuredPatch: patch(1, 0, 1, 1, ['ok']), toolUseId: 'u2', timestamp: 't1' });

  const r = ingest(s, { turnId: 'T2', filePath: '/c.js', structuredPatch: patch(1, 0, 1, 1, ['new']), toolUseId: 'u3', timestamp: 't2' });
  assert.equal(r.turnChanged, true);

  const snap = snapshot(s);
  assert.equal(snap.turnId, 'T2');
  assert.equal(snap.files.length, 1);
  assert.equal(snap.files[0].filePath, '/c.js');
});

test('same turnId + same filePath replaces hunks', () => {
  const s = createState();
  ingest(s, { turnId: 'T1', filePath: '/a.js', structuredPatch: patch(1, 0, 1, 1, ['v1']), toolUseId: 'u1', timestamp: 't0' });
  const r = ingest(s, { turnId: 'T1', filePath: '/a.js', structuredPatch: patch(1, 0, 1, 2, ['v2a', 'v2b']), toolUseId: 'u2', timestamp: 't1' });

  assert.equal(r.turnChanged, false);
  assert.equal(r.fileAdded, false);

  const got = getHunks(s, '/a.js');
  assert.equal(got.hunks.length, 1);
  assert.deepEqual(got.hunks[0].lines, ['+v2a', '+v2b']);
  assert.equal(snapshot(s).files.length, 1);
});

test('same turnId + new filePath appends', () => {
  const s = createState();
  ingest(s, { turnId: 'T1', filePath: '/a.js', structuredPatch: patch(1, 0, 1, 1, ['a']), toolUseId: 'u1', timestamp: 't0' });
  const r = ingest(s, { turnId: 'T1', filePath: '/b.js', structuredPatch: patch(1, 0, 1, 1, ['b']), toolUseId: 'u2', timestamp: 't1' });

  assert.equal(r.turnChanged, false);
  assert.equal(r.fileAdded, true);
  const snap = snapshot(s);
  assert.equal(snap.files.length, 2);
  assert.deepEqual(snap.files.map(f => f.filePath), ['/a.js', '/b.js']);
});

test('Write with isCreate synthesizes a + hunk, status=added', () => {
  const s = createState();
  ingest(s, {
    turnId: 'T1', filePath: '/new.txt',
    isCreate: true, newContent: 'hello\nworld\n',
    toolUseId: 'u1', timestamp: 't0',
  });
  const got = getHunks(s, '/new.txt');
  assert.equal(got.status, 'added');
  assert.equal(got.hunks.length, 1);
  assert.deepEqual(got.hunks[0].lines, ['+hello', '+world']);
  assert.equal(snapshot(s).files[0].status, 'added');
});

test('missing turnId still groups under null; switching to a real turnId resets', () => {
  const s = createState();
  ingest(s, { filePath: '/a.js', structuredPatch: patch(1, 0, 1, 1, ['a']), toolUseId: 'u1', timestamp: 't0' });
  ingest(s, { filePath: '/b.js', structuredPatch: patch(1, 0, 1, 1, ['b']), toolUseId: 'u2', timestamp: 't1' });
  assert.equal(snapshot(s).files.length, 2);

  const r = ingest(s, { turnId: 'T1', filePath: '/c.js', structuredPatch: patch(1, 0, 1, 1, ['c']), toolUseId: 'u3', timestamp: 't2' });
  assert.equal(r.turnChanged, true);
  assert.equal(snapshot(s).files.length, 1);
});

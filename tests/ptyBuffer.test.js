const assert = require('node:assert/strict');
const test = require('node:test');
const { createBufferEntry, appendToRing, drainBuffer } = require('../terminal/ptyBuffer');

test('createBufferEntry stores label and starts attached', () => {
  const e = createBufferEntry('My Tab');
  assert.equal(e.label, 'My Tab');
  assert.equal(e.attached, true);
  assert.equal(e.bufBytes, 0);
});

test('appendToRing accumulates chunks and byte count', () => {
  const e = createBufferEntry();
  appendToRing(e, 'abc');
  appendToRing(e, 'de');
  assert.equal(e.buf.join(''), 'abcde');
  assert.equal(e.bufBytes, 5);
});

test('appendToRing trims oldest chunks once past the byte cap', () => {
  const e = createBufferEntry();
  appendToRing(e, 'aaaa', 10);
  appendToRing(e, 'bbbb', 10);
  appendToRing(e, 'cccc', 10); // would be 12 bytes > 10 -> drop 'aaaa'
  assert.equal(e.buf.join(''), 'bbbbcccc');
  assert.equal(e.bufBytes, 8);
});

test('appendToRing keeps a single oversized chunk whole', () => {
  const e = createBufferEntry();
  appendToRing(e, 'x'.repeat(20), 10);
  assert.equal(e.buf.length, 1);
  assert.equal(e.bufBytes, 20);
});

test('appendToRing counts multibyte UTF-8 bytes, not characters', () => {
  const e = createBufferEntry();
  appendToRing(e, '€'); // 3 bytes in UTF-8
  assert.equal(e.bufBytes, 3);
});

test('drainBuffer returns all output and resets the entry', () => {
  const e = createBufferEntry();
  appendToRing(e, 'hello');
  const out = drainBuffer(e);
  assert.equal(out, 'hello');
  assert.equal(e.bufBytes, 0);
  assert.equal(e.buf.length, 0);
});

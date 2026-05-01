// Unit tests for claude-diff/processWalk.js.
//
// Procfs-dependent helpers are Linux-only; on other platforms those tests
// are skipped. `isClaudeCli` is pure and always tested.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  isClaudeCli,
  readClaudeSessionEnv,
  readCwdLink,
  readComm,
} = require('../claude-diff/processWalk');

const linux = process.platform === 'linux';

test('isClaudeCli matches claude/claude-code basenames in first 3 argv', () => {
  assert.equal(isClaudeCli(['/usr/local/bin/claude']), true);
  assert.equal(isClaudeCli(['/home/u/.nvm/versions/node/v20/bin/node', '/home/u/bin/claude', '--resume']), true);
  assert.equal(isClaudeCli(['/usr/bin/node', 'cli.js', 'claude']), true);
  assert.equal(isClaudeCli(['/usr/bin/node', 'cli.js', 'other', 'claude']), false); // 4th position ignored
  assert.equal(isClaudeCli(['bash', '-c', 'echo']), false);
  assert.equal(isClaudeCli([]), false);
  assert.equal(isClaudeCli(null), false);
});

test('isClaudeCli accepts claude-code variant', () => {
  assert.equal(isClaudeCli(['/usr/bin/claude-code']), true);
  assert.equal(isClaudeCli(['node', '/x/bin/claude-code']), true);
});

test('readClaudeSessionEnv parses CLAUDE_SESSION_ID from /proc/self/environ', { skip: !linux }, () => {
  // This spawns a child with a known env, then reads /proc/<pid>/environ.
  const { spawn } = require('node:child_process');
  const child = spawn('sleep', ['5'], {
    env: { ...process.env, CLAUDE_SESSION_ID: 'test-uuid-1234-abcd' },
    stdio: 'ignore',
    detached: false,
  });
  try {
    const sid = readClaudeSessionEnv(child.pid);
    assert.equal(sid, 'test-uuid-1234-abcd');
  } finally {
    try { child.kill(); } catch (_) {}
  }
});

test('readClaudeSessionEnv returns null when env var absent', { skip: !linux }, () => {
  const { spawn } = require('node:child_process');
  const env = { ...process.env };
  delete env.CLAUDE_SESSION_ID;
  const child = spawn('sleep', ['5'], { env, stdio: 'ignore' });
  try {
    const sid = readClaudeSessionEnv(child.pid);
    assert.equal(sid, null);
  } finally {
    try { child.kill(); } catch (_) {}
  }
});

test('readCwdLink returns cwd of running process', { skip: !linux }, () => {
  const cwd = readCwdLink(process.pid);
  assert.equal(typeof cwd, 'string');
  assert.ok(cwd.length > 0);
});

test('readComm returns process command name', { skip: !linux }, () => {
  const comm = readComm(process.pid);
  assert.equal(typeof comm, 'string');
  assert.ok(comm.length > 0);
});

test('readClaudeSessionEnv handles invalid pid gracefully', () => {
  assert.equal(readClaudeSessionEnv(null), null);
  assert.equal(readClaudeSessionEnv(0), null);
  assert.equal(readClaudeSessionEnv(-1), null);
  assert.equal(readClaudeSessionEnv(999999999), null);
});

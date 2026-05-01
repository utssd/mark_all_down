// Real-fork integration tests for killAppImageWrapper.
//
// These tests exist because the original regression slipped past unit tests:
// every unit test injected a mock `readComm` / `readExe`, so none of them
// ever exercised /proc against a real process.ppid. Here we fork real node
// children so the function reads /proc/<ppid>/comm for real.
//
// Linux-only (requires /proc).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SKIP = process.platform !== 'linux';

const CHILD = `
  const { killAppImageWrapper } = require(${JSON.stringify(path.resolve(__dirname, '..', 'process-lifecycle.js'))});
  const result = killAppImageWrapper({
    env: { APPIMAGE: '/fake/integration.AppImage' },
    execPath: '/tmp/.mount_integrationXYZ/markalldown',
    dryRun: true,
  });
  process.stdout.write(JSON.stringify(result));
`;

test('integration: real process.ppid is NOT AppRun (node test runner is the parent)', { skip: SKIP }, () => {
  // Spawn a child node process. Its parent is the test runner (node itself),
  // so /proc/<ppid>/comm === 'node'. dryRun=true means no SIGTERM is ever
  // sent even if the guard is wrong. The assertion is: guard correctly
  // refuses because parent is not 'AppRun'.
  const proc = spawnSync(process.execPath, ['-e', CHILD], { encoding: 'utf8' });
  assert.equal(proc.status, 0, `child exited with ${proc.status}: ${proc.stderr}`);
  const result = JSON.parse(proc.stdout);
  assert.equal(result.decision, 'refused',
    `parent is not AppRun so guard MUST refuse. Got ${JSON.stringify(result)}`);
  // Either "not-apprun-comm" if comm read succeeded, or "proc-comm-*" if it
  // failed — both are acceptable refusals. The forbidden outcome is "allowed".
  assert.ok(
    ['not-apprun-comm', 'proc-comm-missing', 'proc-comm-denied'].includes(result.reason),
    `unexpected refusal reason: ${result.reason}`,
  );
});

test('integration: regression lock — parent comm is "node", must never be SIGTERM-ed', { skip: SKIP }, () => {
  // This is the exact test that would have caught the original bug.
  // If a future change relaxes the AppRun allow-list, this fails loudly.
  const proc = spawnSync(process.execPath, ['-e', CHILD], { encoding: 'utf8' });
  const result = JSON.parse(proc.stdout);
  assert.notEqual(result.decision, 'allowed',
    `REGRESSION: killAppImageWrapper would SIGTERM the node test runner. ` +
    `This class of bug previously took down gnome-shell on Ubuntu/GNOME. ` +
    `Got: ${JSON.stringify(result)}`);
});

// Unit tests for process-lifecycle.js.
//
// Scope: what is testable without spinning up Electron, an AppImage, or the
// FUSE runtime. These tests assert local invariants of three pure helpers:
// killAppImageWrapper, focusExistingWindow, createRelaunchHandler.
//
// What these tests CANNOT catch, and must not be mistaken for guarding:
//   • Relaunch-after-reinstall behavior inside a real AppImage (the outer
//     FUSE wrapper unmounting /tmp/.mount_* races with anything that tries to
//     exec a replacement from that mount — that's an integration concern).
//   • Anything about process.ppid reparenting under systemd-user (Ubuntu
//     subreaper). Requires a real process tree.
//   • Whether Electron's internal relauncher helper survives a squashfs
//     teardown. Electron implementation detail, not our code.
//
// Keep tests here narrow and boring on purpose — don't re-tile the mock
// graph to mirror the implementation. If a test doesn't reject a behavior
// that would be a real bug, delete it.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  killAppImageWrapper,
  shouldRegisterWrapperKill,
  focusExistingWindow,
  createRelaunchHandler,
} = require('../process-lifecycle');

// ── killAppImageWrapper ────────────────────────────────────────────────────
//
// Contract (default-deny allow-list):
//   SIGTERM is sent ONLY when all of the following hold:
//     1. env.APPIMAGE is truthy, AND
//     2. execPath starts with '/tmp/.mount_' (we are a FUSE-mounted AppImage), AND
//     3. ppid is positive (not 0, null, undefined), AND
//     4. /proc/<ppid>/comm === 'AppRun' (exact, case-sensitive), AND
//     5. /proc/<ppid>/exe resolves under '/tmp/.mount_'.
//
// Every other path refuses with a specific reason. Return shape is
//   { decision: 'allowed'|'refused', reason, ppid, comm, exe }.

function kwCall(overrides = {}) {
  const calls = [];
  const logs = [];
  const result = killAppImageWrapper({
    env: { APPIMAGE: '/foo.AppImage' },
    ppid: 4242,
    execPath: '/tmp/.mount_xyz/markalldown',
    readComm: () => 'AppRun',
    readExe: () => '/tmp/.mount_xyz/AppRun',
    kill: (pid, sig) => calls.push([pid, sig]),
    log: (entry) => logs.push(entry),
    ...overrides,
  });
  return { result, calls, logs };
}

// Positive baseline — the one narrow intersection that permits SIGTERM.

test('killAppImageWrapper: allows SIGTERM when AppRun is ppid inside FUSE mount', () => {
  const { result, calls, logs } = kwCall();
  assert.equal(result.decision, 'allowed');
  assert.equal(result.reason, 'apprun-in-fuse-mount');
  assert.deepEqual(calls, [[4242, 'SIGTERM']]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].decision, 'allowed');
});

// Regression locks — named tests for the ancestors we must never SIGTERM.

test('killAppImageWrapper: never SIGTERMs gnome-shell', () => {
  const { result, calls } = kwCall({
    readComm: () => 'gnome-shell',
    readExe: () => '/usr/bin/gnome-shell',
  });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'not-apprun-comm');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: never SIGTERMs systemd', () => {
  const { result, calls } = kwCall({
    readComm: () => 'systemd',
    readExe: () => '/usr/lib/systemd/systemd',
  });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'not-apprun-comm');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: never SIGTERMs a process named anything other than AppRun', () => {
  // Parametric negative table — every real Ubuntu/GNOME ancestor we have
  // observed, plus near-misses that must still be refused. Adding a new row
  // here is how we harden against new crash scenarios.
  const REFUSE = [
    { name: 'gnome-session-binary', comm: 'gnome-session-b', exe: '/usr/libexec/gnome-session-binary' },
    { name: 'init (ppid=1)',        comm: 'init',            exe: '/sbin/init' },
    { name: 'bash',                 comm: 'bash',            exe: '/usr/bin/bash' },
    { name: 'sh / dash',            comm: 'sh',              exe: '/usr/bin/dash' },
    { name: 'zsh',                  comm: 'zsh',             exe: '/usr/bin/zsh' },
    { name: 'mutter',               comm: 'mutter',          exe: '/usr/bin/mutter' },
    { name: 'xdg-dbus-proxy',       comm: 'xdg-dbus-proxy',  exe: '/usr/libexec/xdg-dbus-proxy' },
    { name: 'dbus-daemon',          comm: 'dbus-daemon',     exe: '/usr/bin/dbus-daemon' },
    { name: 'gnome-terminal-server',comm: 'gnome-terminal-', exe: '/usr/libexec/gnome-terminal-server' },
    { name: 'case mismatch apprun', comm: 'apprun',          exe: '/tmp/.mount_xyz/apprun' },
    { name: 'empty comm',           comm: '',                exe: '/tmp/.mount_xyz/AppRun' },
    { name: 'whitespace comm',      comm: '   ',             exe: '/tmp/.mount_xyz/AppRun' },
  ];
  for (const row of REFUSE) {
    const { result, calls } = kwCall({
      readComm: () => row.comm,
      readExe: () => row.exe,
    });
    assert.equal(result.decision, 'refused', `${row.name} must be refused`);
    assert.equal(calls.length, 0, `${row.name} must not send any signal`);
  }
});

// AppRun-but-not-in-FUSE edge case: malicious or weird env where comm happens
// to be 'AppRun' but the exe path is not under a FUSE mount. Refuse.

test('killAppImageWrapper: refuses when comm is AppRun but exe is not under /tmp/.mount_', () => {
  const { result, calls } = kwCall({
    readComm: () => 'AppRun',
    readExe: () => '/home/user/AppRun',
  });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'exe-not-in-fuse-mount');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: refuses when execPath is not a FUSE mount (dev / deb / tar.gz)', () => {
  // Invariant 3 at the function level: even if someone forgets to gate the
  // handler registration, the function itself refuses outside a FUSE mount.
  const { result, calls } = kwCall({
    execPath: '/usr/bin/markalldown',
  });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'execpath-not-fuse');
  assert.equal(calls.length, 0);
});

// Precondition-missing cases.

test('killAppImageWrapper: refuses when APPIMAGE env is unset', () => {
  const { result, calls } = kwCall({ env: {} });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'no-appimage-env');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: refuses when ppid is null or zero', () => {
  // `undefined` is treated as "use process.ppid default" by the destructuring
  // signature — that's intentional API. `null` and `0` are real values meaning
  // "no parent" and must refuse.
  for (const ppid of [null, 0]) {
    const { result, calls } = kwCall({ ppid });
    assert.equal(result.decision, 'refused');
    assert.equal(result.reason, 'no-ppid');
    assert.equal(calls.length, 0);
  }
});

// /proc read error handling — /proc may be unavailable in namespaced
// containers, hardened kernels with hidepid=2, or during fast teardown.

test('killAppImageWrapper: refuses with specific reason when /proc/<ppid>/comm read fails (ENOENT)', () => {
  const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  const { result, calls } = kwCall({ readComm: () => { throw err; } });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'proc-comm-missing');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: refuses with specific reason when /proc/<ppid>/comm read fails (EACCES)', () => {
  const err = Object.assign(new Error('EACCES'), { code: 'EACCES' });
  const { result, calls } = kwCall({ readComm: () => { throw err; } });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'proc-comm-denied');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: refuses when /proc/<ppid>/exe readlink fails', () => {
  const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  const { result, calls } = kwCall({ readExe: () => { throw err; } });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'proc-exe-unavailable');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: refuses when readExe returns null (readlink "no such link")', () => {
  const { result, calls } = kwCall({ readExe: () => null });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'proc-exe-unavailable');
  assert.equal(calls.length, 0);
});

// Snapshot-drift (invariant 2): the startup snapshot captures the wrapper
// identity once. At quit time, if runtime ppid/comm/exe no longer matches
// the snapshot (e.g. parent died and we got reparented to systemd), refuse.

test('killAppImageWrapper: refuses when runtime ppid differs from snapshot (reparented)', () => {
  const { result, calls } = kwCall({
    snapshot: { ppid: 9999, comm: 'AppRun', exe: '/tmp/.mount_xyz/AppRun' },
    // runtime ppid from kwCall default is 4242 → mismatch
  });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'identity-drift-ppid');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: refuses when runtime comm differs from snapshot', () => {
  const { result, calls } = kwCall({
    snapshot: { ppid: 4242, comm: 'AppRun', exe: '/tmp/.mount_xyz/AppRun' },
    readComm: () => 'systemd', // reparented after startup
    readExe: () => '/usr/lib/systemd/systemd',
  });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'identity-drift-comm');
  assert.equal(calls.length, 0);
});

test('killAppImageWrapper: allows when runtime identity matches snapshot', () => {
  const { result, calls } = kwCall({
    snapshot: { ppid: 4242, comm: 'AppRun', exe: '/tmp/.mount_xyz/AppRun' },
  });
  assert.equal(result.decision, 'allowed');
  assert.deepEqual(calls, [[4242, 'SIGTERM']]);
});

// Dry-run mode — used by real-fork integration tests to inspect the decision
// without actually sending a signal.

test('killAppImageWrapper: dryRun returns decision without calling kill', () => {
  let killCalls = 0;
  const { result } = kwCall({
    dryRun: true,
    kill: () => { killCalls++; },
  });
  assert.equal(result.decision, 'allowed');
  assert.equal(killCalls, 0, 'dryRun must not invoke kill');
});

// kill() throwing does not upgrade refusal to allowed.

test('killAppImageWrapper: returns refused if kill throws (wrapper already gone)', () => {
  const { result, logs } = kwCall({
    kill: () => { throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' }); },
  });
  assert.equal(result.decision, 'refused');
  assert.equal(result.reason, 'kill-failed');
  assert.equal(logs[0].decision, 'refused');
});

// Log discipline — every call must emit exactly one decision log entry.

test('killAppImageWrapper: always emits exactly one log entry with a specific reason', () => {
  const cases = [
    { env: {} },                                                              // no-appimage-env
    { ppid: null },                                                           // no-ppid
    { execPath: '/usr/bin/markalldown' },                                     // execpath-not-fuse
    { readComm: () => 'bash', readExe: () => '/usr/bin/bash' },               // not-apprun-comm
    {},                                                                       // allowed
  ];
  for (const overrides of cases) {
    const { logs } = kwCall(overrides);
    assert.equal(logs.length, 1, 'exactly one log per call');
    assert.ok(logs[0].reason, 'reason must be set');
    assert.notEqual(logs[0].reason, 'unknown', 'reason must be specific, never "unknown"');
    assert.ok(['allowed', 'refused'].includes(logs[0].decision));
  }
});

// ── shouldRegisterWrapperKill (invariant 3 — registration-gate) ───────────

test('shouldRegisterWrapperKill: true only for FUSE-mount execPaths', () => {
  assert.equal(shouldRegisterWrapperKill('/tmp/.mount_abc123/markalldown'), true);
  assert.equal(shouldRegisterWrapperKill('/tmp/.mount_xYz/AppRun'), true);
});

test('shouldRegisterWrapperKill: false for every non-FUSE execPath', () => {
  assert.equal(shouldRegisterWrapperKill('/usr/bin/markalldown'), false);
  assert.equal(shouldRegisterWrapperKill('/home/user/workspace/markalldown/node_modules/electron/dist/electron'), false);
  assert.equal(shouldRegisterWrapperKill('/opt/MarkAllDown/markalldown'), false);
  assert.equal(shouldRegisterWrapperKill('/Applications/MarkAllDown.app/Contents/MacOS/markalldown'), false);
  assert.equal(shouldRegisterWrapperKill('C:\\Program Files\\MarkAllDown\\markalldown.exe'), false);
});

test('shouldRegisterWrapperKill: false for empty/invalid execPath', () => {
  assert.equal(shouldRegisterWrapperKill(''), false);
  assert.equal(shouldRegisterWrapperKill(null), false);
  assert.equal(shouldRegisterWrapperKill(undefined), false);
  assert.equal(shouldRegisterWrapperKill(42), false);
});

// ── focusExistingWindow ────────────────────────────────────────────────────

function fakeWindow(overrides = {}) {
  const calls = [];
  const win = {
    _destroyed: false,
    _minimized: false,
    _visible: true,
    isDestroyed: function () { return this._destroyed; },
    isMinimized: function () { return this._minimized; },
    isVisible: function () { return this._visible; },
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus'),
    moveTop: () => calls.push('moveTop'),
    ...overrides,
  };
  win._calls = calls;
  return win;
}

test('focusExistingWindow is null-safe', () => {
  assert.equal(focusExistingWindow(null), false);
  assert.equal(focusExistingWindow(undefined), false);
});

test('focusExistingWindow does nothing to destroyed windows', () => {
  const win = fakeWindow({ _destroyed: true });
  assert.equal(focusExistingWindow(win), false);
  assert.deepEqual(win._calls, []);
});

test('focusExistingWindow restores a minimized window before focusing', () => {
  const win = fakeWindow({ _minimized: true });
  focusExistingWindow(win);
  assert.deepEqual(win._calls, ['restore', 'focus', 'moveTop']);
});

test('focusExistingWindow shows a hidden window before focusing', () => {
  const win = fakeWindow({ _visible: false });
  focusExistingWindow(win);
  assert.deepEqual(win._calls, ['show', 'focus', 'moveTop']);
});

// ── createRelaunchHandler ──────────────────────────────────────────────────
//
// Implementation (per Tutanota PR #9417):
//   • Linux + packaged + APPIMAGE set → detached spawn(APPIMAGE, args, …),
//     then app.exit(0). No app.relaunch(), no app.quit().
//   • Everything else → app.relaunch() + app.exit(0).
//
// Why these tests can't prove the real fix works: the bug is the FUSE
// squashfs unmount racing the new instance's startup. That's an integration
// concern involving the AppImage runtime, systemd-user reparenting, and
// Electron internals — none of which we can exercise here. These tests only
// verify the local branching, debounce, and error-handling invariants.

function makeRelaunchStubs({
  appImagePath,
  platform = 'linux',
  isPackaged = true,
  spawnThrows = false,
} = {}) {
  const events = [];
  const spawnCalls = [];
  const app = {
    isPackaged,
    exit: (code) => events.push(`exit:${code}`),
    quit: () => events.push('quit'),
    relaunch: () => events.push('relaunch'),
  };
  const spawn = (cmd, args, opts) => {
    spawnCalls.push({ cmd, args, opts });
    events.push('spawn');
    if (spawnThrows) throw new Error('spawn blew up');
    return { unref: () => events.push('unref') };
  };
  return {
    events,
    spawnCalls,
    app,
    spawn,
    handler: createRelaunchHandler({
      app,
      spawn,
      appImagePath,
      args: ['--foo', 'bar'],
      platform,
      isPackaged,
    }),
  };
}

test('createRelaunchHandler ignores clicks after the first one (debounce)', () => {
  const s = makeRelaunchStubs({ appImagePath: '/my.AppImage' });
  assert.equal(s.handler(), true);
  assert.equal(s.handler(), false);
  assert.equal(s.handler(), false);
  // Exactly one spawn and one exit — no duplicates from repeated clicks.
  assert.equal(s.spawnCalls.length, 1);
  assert.equal(s.events.filter((e) => e === 'exit:0').length, 1);
});

test('createRelaunchHandler in packaged Linux AppImage spawns detached then app.exit(0)', () => {
  const s = makeRelaunchStubs({ appImagePath: '/my.AppImage' });
  s.handler();
  // No app.relaunch, no app.quit — only the detached spawn and app.exit(0).
  assert.deepEqual(s.events, ['spawn', 'unref', 'exit:0']);
  assert.equal(s.spawnCalls.length, 1);
  assert.equal(s.spawnCalls[0].cmd, '/my.AppImage');
  assert.deepEqual(s.spawnCalls[0].args, ['--foo', 'bar']);
  assert.equal(s.spawnCalls[0].opts.detached, true);
  assert.equal(s.spawnCalls[0].opts.stdio, 'ignore');
});

test('createRelaunchHandler without AppImage path uses Electron app.relaunch()', () => {
  const s = makeRelaunchStubs({ appImagePath: undefined });
  s.handler();
  assert.deepEqual(s.events, ['relaunch', 'exit:0']);
  assert.equal(s.spawnCalls.length, 0);
});

test('createRelaunchHandler on non-Linux falls back to app.relaunch() even with APPIMAGE set', () => {
  // APPIMAGE could theoretically leak into the env on other platforms via
  // WSL or test runners — don't blindly trust it off Linux.
  const s = makeRelaunchStubs({ appImagePath: '/my.AppImage', platform: 'darwin' });
  s.handler();
  assert.deepEqual(s.events, ['relaunch', 'exit:0']);
  assert.equal(s.spawnCalls.length, 0);
});

test('createRelaunchHandler unpackaged (npm start) uses app.relaunch() even with APPIMAGE set', () => {
  const s = makeRelaunchStubs({ appImagePath: '/my.AppImage', isPackaged: false });
  s.handler();
  assert.deepEqual(s.events, ['relaunch', 'exit:0']);
  assert.equal(s.spawnCalls.length, 0);
});

test('createRelaunchHandler still calls app.exit(0) if spawn throws', () => {
  // If spawn blows up, we must still exit — otherwise the user is left with
  // a zombie app that also didn't restart.
  const s = makeRelaunchStubs({ appImagePath: '/my.AppImage', spawnThrows: true });
  assert.doesNotThrow(() => s.handler());
  assert.equal(s.events.filter((e) => e === 'exit:0').length, 1);
});

// ── APPIMAGE-unset fallback paths ─────────────────────────────────────────
//
// On some Linux launch paths (observed Ubuntu/GNOME), process.env.APPIMAGE
// doesn't reach the electron main process. When execPath is inside a FUSE
// mount, fall back to probing known AppImage install locations.

test('createRelaunchHandler probes candidatePaths when APPIMAGE is unset but execPath is a FUSE mount', () => {
  const events = [];
  const spawnCalls = [];
  const app = {
    isPackaged: true,
    exit: (c) => events.push(`exit:${c}`),
    quit: () => events.push('quit'),
    relaunch: () => events.push('relaunch'),
  };
  const spawn = (cmd, args, opts) => {
    spawnCalls.push({ cmd, args, opts });
    events.push('spawn');
    return { unref: () => events.push('unref') };
  };
  const existing = '/home/me/.local/bin/MarkAllDown.AppImage';
  const handler = createRelaunchHandler({
    app,
    spawn,
    appImagePath: undefined,
    args: [],
    platform: 'linux',
    isPackaged: true,
    execPath: '/tmp/.mount_MarkAlqywVAI/markalldown',
    candidatePaths: ['/missing/one.AppImage', existing],
    fileExists: (p) => p === existing,
  });
  handler();
  assert.deepEqual(events, ['spawn', 'unref', 'exit:0']);
  assert.equal(spawnCalls[0].cmd, existing);
});

test('createRelaunchHandler without APPIMAGE and without FUSE execPath falls back to app.relaunch()', () => {
  // Unpackaged-ish path: execPath isn't a FUSE mount, so even the candidate
  // probe shouldn't kick in — this matches npm start behavior.
  const events = [];
  const app = {
    isPackaged: true,
    exit: (c) => events.push(`exit:${c}`),
    quit: () => events.push('quit'),
    relaunch: () => events.push('relaunch'),
  };
  const handler = createRelaunchHandler({
    app,
    spawn: () => assert.fail('should not spawn'),
    appImagePath: undefined,
    args: [],
    platform: 'linux',
    isPackaged: true,
    execPath: '/usr/bin/electron',
    candidatePaths: ['/home/me/.local/bin/MarkAllDown.AppImage'],
    fileExists: () => true,
  });
  handler();
  assert.deepEqual(events, ['relaunch', 'exit:0']);
});

test('createRelaunchHandler surfaces error + exits when inside FUSE mount but no candidate resolves', () => {
  // Worst case: APPIMAGE unset, execPath is FUSE, no candidates exist.
  // Calling app.relaunch() here would respawn the FUSE path — which vanishes
  // the moment we exit. Don't do that silently; show a dialog and exit.
  const events = [];
  const dialogs = [];
  const app = {
    isPackaged: true,
    exit: (c) => events.push(`exit:${c}`),
    quit: () => events.push('quit'),
    relaunch: () => events.push('relaunch'),
  };
  const handler = createRelaunchHandler({
    app,
    spawn: () => assert.fail('should not spawn'),
    appImagePath: undefined,
    args: [],
    platform: 'linux',
    isPackaged: true,
    execPath: '/tmp/.mount_MarkAlXXXXXX/markalldown',
    candidatePaths: ['/missing/a.AppImage'],
    fileExists: () => false,
    errorDialog: (title, body) => dialogs.push({ title, body }),
  });
  handler();
  assert.deepEqual(events, ['exit:0']);
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0].title, /Relaunch/);
});

test('createRelaunchHandler log callback records which branch ran', () => {
  const calls = [];
  const app = {
    isPackaged: true,
    exit: () => {},
    quit: () => {},
    relaunch: () => {},
  };
  const handler = createRelaunchHandler({
    app,
    spawn: () => ({ unref: () => {} }),
    appImagePath: '/my.AppImage',
    args: [],
    platform: 'linux',
    isPackaged: true,
    execPath: '/tmp/.mount_x/markalldown',
    log: (entry) => calls.push(entry),
  });
  handler();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].branch, 'detached-spawn');
  assert.equal(calls[0].resolvedPath, '/my.AppImage');
  assert.equal(calls[0].source, 'env.APPIMAGE');
});

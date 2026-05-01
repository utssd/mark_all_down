// Process lifecycle helpers extracted from main.js for testability.
//
// These are deliberately pure/injectable so they can be covered by node:test
// without spinning up Electron.

// Signal the outer AppImage wrapper (process.ppid) to trigger its FUSE
// unmount + exit path. Default-deny: we signal ONLY when we can prove the
// target is the AppRun wrapper inside a FUSE mount. On every other path we
// refuse — historically we would blindly SIGTERM process.ppid whenever
// APPIMAGE was set, which on Ubuntu/GNOME launches (where ppid is
// gnome-shell / gnome-session-binary / systemd --user) crashed the desktop.
//
// Returns { decision, reason, ppid, comm, exe }. Always emits exactly one
// log entry. Never throws.
const APPRUN_COMM = 'AppRun';
const FUSE_PREFIX = '/tmp/.mount_';

function defaultReadComm(pid) {
  return require('fs').readFileSync(`/proc/${pid}/comm`, 'utf8').replace(/\n$/, '');
}

function defaultReadExe(pid) {
  try {
    return require('fs').readlinkSync(`/proc/${pid}/exe`);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

function killAppImageWrapper({
  env = process.env,
  ppid = process.ppid,
  execPath = process.execPath,
  readComm = defaultReadComm,
  readExe = defaultReadExe,
  kill = process.kill.bind(process),
  snapshot = null,
  dryRun = false,
  log = () => {},
} = {}) {
  const emit = (decision, reason, extra = {}) => {
    const entry = { decision, reason, ppid, ...extra };
    try { log(entry); } catch (_) {}
    return entry;
  };

  if (!env || !env.APPIMAGE) {
    return emit('refused', 'no-appimage-env');
  }
  if (typeof ppid !== 'number' || ppid <= 0) {
    return emit('refused', 'no-ppid');
  }
  if (typeof execPath !== 'string' || !execPath.startsWith(FUSE_PREFIX)) {
    return emit('refused', 'execpath-not-fuse', { execPath });
  }
  if (snapshot && snapshot.ppid !== ppid) {
    return emit('refused', 'identity-drift-ppid', { snapshot });
  }

  let comm;
  try {
    comm = readComm(ppid);
  } catch (err) {
    const code = err && err.code;
    if (code === 'EACCES' || code === 'EPERM') return emit('refused', 'proc-comm-denied');
    return emit('refused', 'proc-comm-missing');
  }
  if (snapshot && snapshot.comm !== comm) {
    return emit('refused', 'identity-drift-comm', { comm, snapshot });
  }
  if (typeof comm !== 'string' || comm.trim() === '' || comm !== APPRUN_COMM) {
    return emit('refused', 'not-apprun-comm', { comm });
  }

  let exe;
  try {
    exe = readExe(ppid);
  } catch (_) {
    return emit('refused', 'proc-exe-unavailable');
  }
  if (exe == null) {
    return emit('refused', 'proc-exe-unavailable');
  }
  if (!exe.startsWith(FUSE_PREFIX)) {
    return emit('refused', 'exe-not-in-fuse-mount', { comm, exe });
  }

  if (dryRun) {
    return emit('allowed', 'apprun-in-fuse-mount', { comm, exe, dryRun: true });
  }

  try {
    kill(ppid, 'SIGTERM');
  } catch (_) {
    return emit('refused', 'kill-failed', { comm, exe });
  }
  return emit('allowed', 'apprun-in-fuse-mount', { comm, exe });
}

// Whether the will-quit AppImage-wrapper kill handler should even be
// registered. Invariant 3: outside a FUSE mount there is no wrapper to kill,
// so skip registration entirely. Exposed for testing.
function shouldRegisterWrapperKill(execPath = process.execPath) {
  return typeof execPath === 'string' && execPath.startsWith(FUSE_PREFIX);
}

// Called from `second-instance` when a user double-launches MAD. We want the
// existing instance's window to become visible and focused, even if it was
// minimized, hidden, or on another X11 workspace.
//
// `win` is a BrowserWindow-shaped object (null-safe).
function focusExistingWindow(win) {
  if (!win) return false;
  if (typeof win.isDestroyed === 'function' && win.isDestroyed()) return false;
  if (win.isMinimized?.()) win.restore?.();
  if (win.isVisible && !win.isVisible()) win.show?.();
  win.focus?.();
  win.moveTop?.();
  return true;
}

// Factory for the Relaunch menu click handler. Returns a function that is
// safe to call multiple times in quick succession — only the first call
// does anything. Debounces double-clicks so we don't spawn twice.
//
// Relaunch strategy (matches Tutanota PR #9417):
//   • Inside a packaged Linux AppImage: fire-and-forget a detached spawn of
//     the APPIMAGE path. Two instances briefly coexist — each mounts its own
//     /tmp/.mount_* squashfs, so there's no unmount race to lose. Then call
//     app.exit(0) to get the old process out fast.
//   • Elsewhere (npm start, .deb, macOS, Windows): use Electron's built-in
//     app.relaunch(), then app.exit(0).
//
// Why app.exit(0) rather than app.quit(): exit(0) skips will-quit handlers,
// which matters because the will-quit handler SIGTERMs the AppImage wrapper
// (killAppImageWrapper). If that kill races the squashfs unmount before the
// new instance is running, the whole relaunch is a flap.
//
// Path resolution fallback: process.env.APPIMAGE is not always populated in
// the electron main process (observed on Ubuntu/GNOME launches where some
// launch paths don't propagate it). When we detect we're running from a
// FUSE mount (execPath starts with /tmp/.mount_), probe known install
// locations as a fallback. Without this, the handler would call
// app.relaunch(), which respawns process.execPath — a path inside the FUSE
// mount that disappears as soon as the old process exits.
function createRelaunchHandler({
  app,
  spawn,
  appImagePath, // process.env.APPIMAGE or similar (may be undefined)
  args = [],
  platform = process.platform,
  isPackaged = typeof app?.isPackaged === 'boolean' ? app.isPackaged : true,
  execPath = process.execPath,
  candidatePaths = [], // additional AppImage install paths to probe when APPIMAGE is unset
  fileExists = () => false,
  log = () => {},
  errorDialog = () => {},
}) {
  let queued = false;
  return () => {
    if (queued) return false;
    queued = true;

    if (platform === 'linux' && isPackaged) {
      let resolvedPath = appImagePath;
      let source = resolvedPath ? 'env.APPIMAGE' : null;
      if (!resolvedPath && typeof execPath === 'string' && execPath.startsWith('/tmp/.mount_')) {
        for (const cand of candidatePaths) {
          if (cand && fileExists(cand)) {
            resolvedPath = cand;
            source = 'candidate';
            break;
          }
        }
      }

      if (resolvedPath) {
        log({ branch: 'detached-spawn', resolvedPath, source, appImagePath, execPath });
        try {
          spawn(resolvedPath, args, { detached: true, stdio: 'ignore' }).unref();
        } catch (err) {
          log({ branch: 'detached-spawn-failed', error: String(err && err.message || err) });
          errorDialog('Relaunch failed', `Could not spawn ${resolvedPath}: ${err.message}`);
        }
        app.exit(0);
        return true;
      }

      // Running from a FUSE mount but couldn't resolve a stable path. Falling
      // back to app.relaunch() here means respawning the FUSE path, which
      // will fail silently. Surface the problem instead.
      if (typeof execPath === 'string' && execPath.startsWith('/tmp/.mount_')) {
        log({ branch: 'no-appimage-path', execPath, candidatePaths });
        errorDialog(
          'Relaunch unavailable',
          'Could not locate the installed AppImage. Please quit and relaunch manually.',
        );
        app.exit(0);
        return true;
      }
    }

    log({ branch: 'electron-relaunch', appImagePath, execPath });
    app.relaunch();
    app.exit(0);
    return true;
  };
}

module.exports = {
  killAppImageWrapper,
  shouldRegisterWrapperKill,
  focusExistingWindow,
  createRelaunchHandler,
};

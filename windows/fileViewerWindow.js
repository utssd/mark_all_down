// File-viewer pop-up windows — a registry of N windows (unlike the singleton
// plan/diff windows). Each trigger spawns a new window; bounds cascade so they
// don't stack exactly. Lifecycle tied to the main window.

'use strict';

const path = require('path');
const { createPopupWindow, DEFAULT_BOUNDS } = require('./popupWindow');

const _wins = new Map(); // webContents.id -> BrowserWindow
let _cascade = 0;

function createFileViewerWindow({ parentWindow, loadSettings, saveSettings, onOpenDiff, onOpenPlan, onOpenByPath, onCycleFocus }) {
  const settings = loadSettings();
  const cfg = settings.fileViewer || {};
  const base = cfg.windowBounds || null;
  const offset = (_cascade % 6) * 30;
  _cascade++;
  const savedBounds = base
    ? { ...base, x: (typeof base.x === 'number' ? base.x : 80) + offset, y: (typeof base.y === 'number' ? base.y : 80) + offset }
    : { ...DEFAULT_BOUNDS, x: 80 + offset, y: 80 + offset };

  const win = createPopupWindow({
    parent: parentWindow,
    htmlPath: path.join(__dirname, '..', 'file-viewer.html'),
    preloadPath: path.join(__dirname, '..', 'preload-popup.js'),
    savedBounds,
    // Always start unpinned — pin is per-window and session-only (not persisted),
    // so opening a new viewer never inherits a previous one's pinned state.
    alwaysOnTop: false,
    title: 'File Viewer',
    onBoundsChanged: (bounds) => {
      try {
        const s = loadSettings();
        s.fileViewer = s.fileViewer || {};
        s.fileViewer.windowBounds = bounds;
        saveSettings(s);
      } catch (_) {}
    },
    onOpenDiff,
    onOpenPlan,
    onOpenByPath,
    onCycleFocus,
  });

  // Capture shortcut keys at the window level via before-input-event. This fires
  // for every key the window receives REGARDLESS of which frame has focus —
  // crucial because HTML files render in a sandboxed <iframe> that would
  // otherwise swallow keydown events (o/p/Esc/scroll never reach the renderer's
  // own document listener). We forward the logical key to the renderer, which is
  // the single key handler for the window.
  const VIEWER_KEYS = new Set([
    'o', 'O', 'p', 'P', 'Escape',
    'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End',
  ]);
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control || input.meta || input.alt) return;
    if (!VIEWER_KEYS.has(input.key)) return;
    event.preventDefault(); // stop the iframe (or page) from also acting
    if (!win.isDestroyed()) win.webContents.send('viewer:key', { key: input.key });
  });

  const id = win.webContents.id;
  _wins.set(id, win);
  win.on('closed', () => { _wins.delete(id); });
  return win;
}

function getFileViewerWindow(webContentsId) {
  return _wins.get(webContentsId) || null;
}

function closeAllFileViewerWindows() {
  for (const win of _wins.values()) {
    try { if (!win.isDestroyed()) win.close(); } catch (_) {}
  }
  _wins.clear();
}

module.exports = { createFileViewerWindow, getFileViewerWindow, closeAllFileViewerWindows };

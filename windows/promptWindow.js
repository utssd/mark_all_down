// Open-File-by-Path prompt — a small, singleton, always-on-top dialog window.
//
// Deliberately NOT built on createPopupWindow (whose 700x820 MIN_SIZE is far too
// big for a one-field prompt) and NOT a modal inside the main window (which can't
// be reliably raised above pinned popups / focus-stealing prevention on X11).
// A freshly-created always-on-top window at the 'screen-saver' level rises above
// every other app window — reader, diff, plan, and even pinned (level 'floating')
// file-viewer popups — and takes focus on the user-initiated trigger.

'use strict';

const path = require('path');
const { BrowserWindow, shell } = require('electron');

const SIZE = { width: 560, height: 320 };

let winRef = null;

function getPromptWindow() {
  return winRef;
}

function getOrCreatePromptWindow({ parentWindow }) {
  if (winRef && !winRef.isDestroyed()) {
    // Re-trigger: raise and refocus the existing prompt.
    if (winRef.isMinimized()) winRef.restore();
    winRef.setAlwaysOnTop(true, 'screen-saver');
    winRef.show();
    winRef.focus();
    return winRef;
  }

  const win = new BrowserWindow({
    width: SIZE.width,
    height: SIZE.height,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    title: 'Open File by Path',
    backgroundColor: '#161b22',
    // No `parent`: on Linux/X11 a parent sets WM_TRANSIENT_FOR which can tie the
    // dialog's stacking to the main window; we want it above ALL windows.
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload-prompt.js'),
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'prompt.html'));

  win.once('ready-to-show', () => {
    // 'screen-saver' is the highest standard level — above 'floating' used by the
    // pinned diff/plan/viewer popups, so the prompt is never occluded by them.
    win.setAlwaysOnTop(true, 'screen-saver');
    win.center();
    win.show();
    win.focus();
    try { win.webContents.focus(); } catch (_) {}
  });

  win.on('closed', () => { winRef = null; });

  // External links → default browser (defensive; the prompt has none today).
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  winRef = win;
  return win;
}

function closePromptWindow() {
  if (winRef && !winRef.isDestroyed()) {
    try { winRef.close(); } catch (_) {}
  }
  winRef = null;
}

module.exports = {
  getPromptWindow,
  getOrCreatePromptWindow,
  closePromptWindow,
};

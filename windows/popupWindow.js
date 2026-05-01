// Shared factory for the diff and plan pop-up windows. Both are singleton
// BrowserWindow instances tied to the main window, with bounds + pin state
// persisted into settings.

'use strict';

const path = require('path');
const { BrowserWindow, Menu } = require('electron');

const DEFAULT_BOUNDS = { width: 1100, height: 960 };
const MIN_SIZE = { minWidth: 700, minHeight: 820 };

function clampBounds(bounds, displayBounds) {
  if (!bounds) return null;
  const out = {};
  if (typeof bounds.width === 'number' && bounds.width >= MIN_SIZE.minWidth) out.width = Math.min(bounds.width, displayBounds.width);
  if (typeof bounds.height === 'number' && bounds.height >= MIN_SIZE.minHeight) out.height = Math.min(bounds.height, displayBounds.height);
  if (typeof bounds.x === 'number' && typeof bounds.y === 'number') {
    out.x = Math.max(displayBounds.x, Math.min(bounds.x, displayBounds.x + displayBounds.width - (out.width || DEFAULT_BOUNDS.width)));
    out.y = Math.max(displayBounds.y, Math.min(bounds.y, displayBounds.y + displayBounds.height - (out.height || DEFAULT_BOUNDS.height)));
  }
  return out;
}

function createPopupWindow({
  parent,
  htmlPath,
  preloadPath,
  savedBounds,
  alwaysOnTop = false,
  title = 'Claude',
  onBoundsChanged,
  onClosed,
  onOpenDiff,
  onOpenPlan,
  onCycleFocus,
}) {
  const { screen } = require('electron');
  const displayBounds = screen.getPrimaryDisplay().workArea;
  const clamped = clampBounds(savedBounds, displayBounds) || DEFAULT_BOUNDS;

  // Deliberately not setting `parent`: on Linux/X11 it sets WM_TRANSIENT_FOR,
  // which pins the popup above its parent and prevents Ctrl+` from ever
  // bringing the main window to the front.
  const win = new BrowserWindow({
    ...MIN_SIZE,
    width: clamped.width || DEFAULT_BOUNDS.width,
    height: clamped.height || DEFAULT_BOUNDS.height,
    x: clamped.x,
    y: clamped.y,
    title,
    show: false,
    alwaysOnTop,
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  // Build a hidden local menu so CmdOrCtrl+Shift+D / CmdOrCtrl+Shift+P /
  // CmdOrCtrl+` accelerators fire while this popup has focus. Without it,
  // Electron routes the keypress to the (empty) menu of the focused window
  // and nothing else.
  if (onOpenDiff || onOpenPlan || onCycleFocus) {
    const localMenu = Menu.buildFromTemplate([
      {
        label: 'Claude',
        submenu: [
          {
            label: 'Open Claude Diff Viewer',
            accelerator: 'CmdOrCtrl+Shift+D',
            visible: false,
            click: () => { if (onOpenDiff) try { onOpenDiff(); } catch (_) {} },
          },
          {
            label: 'Open Claude Plan Viewer',
            accelerator: 'CmdOrCtrl+Shift+P',
            visible: false,
            click: () => { if (onOpenPlan) try { onOpenPlan(); } catch (_) {} },
          },
          {
            label: 'Cycle Windows',
            accelerator: 'CmdOrCtrl+`',
            visible: false,
            click: () => { if (onCycleFocus) try { onCycleFocus(); } catch (_) {} },
          },
        ],
      },
    ]);
    win.setMenu(localMenu);
  }
  win.setMenuBarVisibility(false);
  win.loadFile(htmlPath);

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    try { win.webContents.focus(); } catch (_) {}
  });

  let pendingSave = null;
  const scheduleBoundsSave = () => {
    if (pendingSave) clearTimeout(pendingSave);
    pendingSave = setTimeout(() => {
      pendingSave = null;
      if (win.isDestroyed()) return;
      const b = win.getBounds();
      if (onBoundsChanged) onBoundsChanged(b);
    }, 400);
  };
  win.on('resize', scheduleBoundsSave);
  win.on('move', scheduleBoundsSave);

  win.on('closed', () => {
    if (pendingSave) { clearTimeout(pendingSave); pendingSave = null; }
    if (onClosed) onClosed();
  });

  // External links → default browser.
  const { shell } = require('electron');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (url !== current && /^https?:/i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

module.exports = {
  createPopupWindow,
  DEFAULT_BOUNDS,
};

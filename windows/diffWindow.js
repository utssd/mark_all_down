// Diff viewer pop-up window — singleton, lifecycle tied to main window.

'use strict';

const path = require('path');
const { createPopupWindow } = require('./popupWindow');

let winRef = null;

function getDiffWindow() {
  return winRef;
}

function getOrCreateDiffWindow({ parentWindow, loadSettings, saveSettings, onOpenDiff, onOpenPlan, onCycleFocus }) {
  if (winRef && !winRef.isDestroyed()) {
    if (winRef.isMinimized()) winRef.restore();
    winRef.show();
    winRef.focus();
    return winRef;
  }
  const settings = loadSettings();
  const diff = settings.diffViewer || {};

  const win = createPopupWindow({
    parent: parentWindow,
    htmlPath: path.join(__dirname, '..', 'diff.html'),
    preloadPath: path.join(__dirname, '..', 'preload-popup.js'),
    savedBounds: diff.windowBounds || null,
    alwaysOnTop: !!diff.alwaysOnTop,
    title: 'Claude Diff',
    onBoundsChanged: (bounds) => {
      try {
        const s = loadSettings();
        s.diffViewer = s.diffViewer || {};
        s.diffViewer.windowBounds = bounds;
        saveSettings(s);
      } catch (_) {}
    },
    onClosed: () => { winRef = null; },
    onOpenDiff,
    onOpenPlan,
    onCycleFocus,
  });

  winRef = win;
  return win;
}

function closeDiffWindow() {
  if (winRef && !winRef.isDestroyed()) {
    try { winRef.close(); } catch (_) {}
  }
  winRef = null;
}

function toggleDiffPin({ loadSettings, saveSettings }) {
  if (!winRef || winRef.isDestroyed()) return false;
  const next = !winRef.isAlwaysOnTop();
  winRef.setAlwaysOnTop(next);
  try {
    const s = loadSettings();
    s.diffViewer = s.diffViewer || {};
    s.diffViewer.alwaysOnTop = next;
    saveSettings(s);
  } catch (_) {}
  return next;
}

module.exports = {
  getDiffWindow,
  getOrCreateDiffWindow,
  closeDiffWindow,
  toggleDiffPin,
};

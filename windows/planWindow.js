// Plan viewer pop-up window — singleton, lifecycle tied to main window.

'use strict';

const path = require('path');
const { createPopupWindow } = require('./popupWindow');

let winRef = null;

function getPlanWindow() {
  return winRef;
}

function getOrCreatePlanWindow({ parentWindow, loadSettings, saveSettings, onOpenDiff, onOpenPlan, onCycleFocus }) {
  if (winRef && !winRef.isDestroyed()) {
    if (winRef.isMinimized()) winRef.restore();
    winRef.show();
    winRef.focus();
    return winRef;
  }
  const settings = loadSettings();
  const plan = settings.planViewer || {};

  const win = createPopupWindow({
    parent: parentWindow,
    htmlPath: path.join(__dirname, '..', 'plan.html'),
    preloadPath: path.join(__dirname, '..', 'preload-popup.js'),
    savedBounds: plan.windowBounds || null,
    alwaysOnTop: !!plan.alwaysOnTop,
    title: 'Claude Plan',
    onBoundsChanged: (bounds) => {
      try {
        const s = loadSettings();
        s.planViewer = s.planViewer || {};
        s.planViewer.windowBounds = bounds;
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

function closePlanWindow() {
  if (winRef && !winRef.isDestroyed()) {
    try { winRef.close(); } catch (_) {}
  }
  winRef = null;
}

function togglePlanPin({ loadSettings, saveSettings }) {
  if (!winRef || winRef.isDestroyed()) return false;
  const next = !winRef.isAlwaysOnTop();
  winRef.setAlwaysOnTop(next);
  try {
    const s = loadSettings();
    s.planViewer = s.planViewer || {};
    s.planViewer.alwaysOnTop = next;
    saveSettings(s);
  } catch (_) {}
  return next;
}

module.exports = {
  getPlanWindow,
  getOrCreatePlanWindow,
  closePlanWindow,
  togglePlanPin,
};

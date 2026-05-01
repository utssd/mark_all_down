// Preload for the diff and plan pop-up windows.
// Exposes window.popupAPI — the union of diff + plan IPC channels.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupAPI', {
  // --- Settings (for font configuration parity with main window) ---
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  onSettingsChanged: (cb) => ipcRenderer.on('settings:changed', (_e, data) => cb(data)),

  // --- Diff ---
  diffResolveTabSession: (opts) => ipcRenderer.invoke('diff:resolveTabSession', opts || {}),
  diffListSessions: (opts) => ipcRenderer.invoke('diff:listSessions', opts || {}),
  diffBindSession: (data) => ipcRenderer.invoke('diff:bindSession', data),
  diffGetBinding: () => ipcRenderer.invoke('diff:getBinding'),
  diffGetTabBinding: (opts) => ipcRenderer.invoke('diff:getTabBinding', opts || {}),
  diffClearBinding: () => ipcRenderer.invoke('diff:clearBinding'),
  diffSnapshot: () => ipcRenderer.invoke('diff:snapshot'),
  diffGetHunks: (filePath) => ipcRenderer.invoke('diff:getHunks', { filePath }),
  diffSubscribe: () => ipcRenderer.invoke('diff:subscribe'),
  diffUnsubscribe: () => ipcRenderer.invoke('diff:unsubscribe'),
  onDiffUpdated: (cb) => ipcRenderer.on('diff:updated', (_e, data) => cb(data)),
  onDiffError: (cb) => ipcRenderer.on('diff:error', (_e, data) => cb(data)),
  onDiffTabSwitched: (cb) => ipcRenderer.on('diff:tabSwitched', (_e, data) => cb(data)),
  diffCloseWindow: () => ipcRenderer.invoke('diff:closeWindow'),
  diffTogglePin: () => ipcRenderer.invoke('diff:togglePin'),

  // --- Plan ---
  planResolveTabSession: (opts) => ipcRenderer.invoke('plan:resolveTabSession', opts || {}),
  planListPlans: (opts) => ipcRenderer.invoke('plan:listPlans', opts || {}),
  planLoadPlan: (arg) => ipcRenderer.invoke('plan:loadPlan', typeof arg === 'string' ? { path: arg } : (arg || {})),
  planWatchPlan: (arg) => ipcRenderer.invoke('plan:watchPlan', typeof arg === 'string' ? { path: arg } : (arg || {})),
  planUnwatchPlan: () => ipcRenderer.invoke('plan:unwatchPlan'),
  planGetCurrent: () => ipcRenderer.invoke('plan:getCurrent'),
  onPlanUpdated: (cb) => ipcRenderer.on('plan:updated', (_e, data) => cb(data)),
  onPlanError: (cb) => ipcRenderer.on('plan:error', (_e, data) => cb(data)),
  onPlanRemoved: (cb) => ipcRenderer.on('plan:removed', (_e, data) => cb(data)),
  onPlanTabSwitched: (cb) => ipcRenderer.on('plan:tabSwitched', (_e, data) => cb(data)),
  onPlanNoBinding: (cb) => ipcRenderer.on('plan:noBinding', (_e, data) => cb(data)),
  planCloseWindow: () => ipcRenderer.invoke('plan:closeWindow'),
  planTogglePin: () => ipcRenderer.invoke('plan:togglePin'),
});

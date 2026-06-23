// Preload for the Open-File-by-Path prompt window (a small always-on-top dialog).
// Exposes window.promptAPI — the channels the prompt renderer needs.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptAPI', {
  // Detected context for the "Auto" source label ({ scope, hostLabel, cwd }).
  detect: () => ipcRenderer.invoke('prompt:detect'),
  // Open the file: { path, source } → { success } or { success:false, error }.
  // On success the main process closes this window.
  submit: (data) => ipcRenderer.invoke('prompt:submit', data || {}),
  // Dismiss the prompt without opening anything.
  cancel: () => ipcRenderer.invoke('prompt:cancel'),
});

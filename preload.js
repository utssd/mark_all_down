const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  saveHtml: (data) => ipcRenderer.invoke('dialog:saveHtml', data),
  onMenuOpenFile: (callback) => ipcRenderer.on('menu:openFile', callback),
  onMenuSaveFile: (callback) => ipcRenderer.on('menu:saveFile', callback),
  onFileOpened: (callback) => ipcRenderer.on('file:opened', (_event, data) => callback(data)),

  syncFile: (data) => ipcRenderer.invoke('ssh:sync', data),
  testSshConnection: (config) => ipcRenderer.invoke('ssh:testConnection', config),
  copySshKey: (data) => ipcRenderer.invoke('ssh:copyKey', data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  sshListFiles: (data) => ipcRenderer.invoke('remote:sshListFiles', data || {}),
  sshReadFile: (data) => ipcRenderer.invoke('remote:sshReadFile', data),
  onMenuOpenFromSsh: (callback) => ipcRenderer.on('menu:openFromSsh', callback),

  onMenuFind: (callback) => ipcRenderer.on('menu:find', callback),

  loadPage: (data) => ipcRenderer.invoke('pages:loadPage', data),
  listFiles: (data) => ipcRenderer.invoke('pages:listFiles', data),
});

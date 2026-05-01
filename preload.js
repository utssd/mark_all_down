const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options || {}),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  saveHtml: (data) => ipcRenderer.invoke('dialog:saveHtml', data),
  onMenuOpenFile: (callback) => ipcRenderer.on('menu:openFile', callback),
  onMenuOpenRemote: (callback) => ipcRenderer.on('menu:openRemote', callback),
  onMenuSaveFile: (callback) => ipcRenderer.on('menu:saveFile', callback),
  onMenuSaveRemote: (callback) => ipcRenderer.on('menu:saveRemote', callback),
  onFileOpened: (callback) => ipcRenderer.on('file:opened', (_event, data) => callback(data)),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  webdavListFiles: (data) => ipcRenderer.invoke('webdav:listFiles', data || {}),
  webdavReadFile: (data) => ipcRenderer.invoke('webdav:readFile', data),
  webdavWriteFile: (data) => ipcRenderer.invoke('webdav:writeFile', data),
  webdavStat: (data) => ipcRenderer.invoke('webdav:stat', data),
  webdavTestConnection: () => ipcRenderer.invoke('webdav:testConnection'),
  openPrivateKey: () => ipcRenderer.invoke('dialog:openPrivateKey'),
  readPdfFile: (filePath) => ipcRenderer.invoke('dialog:readPdfFile', filePath),
  readFileConfirmed: (filePath) => ipcRenderer.invoke('dialog:readFileConfirmed', filePath),

  onMenuFind: (callback) => ipcRenderer.on('menu:find', callback),

  loadPage: (data) => ipcRenderer.invoke('pages:loadPage', data),
  listFiles: (data) => ipcRenderer.invoke('pages:listFiles', data),

  callLLM: (data) => ipcRenderer.invoke('llm:call', data),
  testLLMConnection: (data) => ipcRenderer.invoke('llm:test', data || {}),
  fetchLLMModels: (data) => ipcRenderer.invoke('llm:fetchModels', data || {}),

  runAgent: (data) => ipcRenderer.invoke('agent:run', data),
  cancelAgent: (data) => ipcRenderer.invoke('agent:cancel', data),
  agentMessage: (data) => ipcRenderer.invoke('agent:message', data),
  agentStatus: (data) => ipcRenderer.invoke('agent:status', data),
  listAgents: () => ipcRenderer.invoke('agent:list'),
  reloadAgents: () => ipcRenderer.invoke('agent:reload'),
  onAgentProgress: (cb) => ipcRenderer.on('agent:progress', (_e, data) => cb(data)),
  onAgentOpenWebdavFile: (cb) => ipcRenderer.on('agent:openWebdavFile', (_e, data) => cb(data)),
  onAgentListChanged: (cb) => ipcRenderer.on('agent:list:changed', (_e, data) => cb(data)),

  runCloudAgent: (data) => ipcRenderer.invoke('cloud-agent:run', data),
  cancelCloudAgent: (data) => ipcRenderer.invoke('cloud-agent:cancel', data),
  cloudAgentMessage: (data) => ipcRenderer.invoke('cloud-agent:message', data),

  trackerRegistry: () => ipcRenderer.invoke('tracker:registry'),
  trackerSyncRemote: (d) => ipcRenderer.invoke('tracker:syncRemote', d),

  cloudRegister: (d) => ipcRenderer.invoke('cloud:register', d),
  cloudLogin: (d) => ipcRenderer.invoke('cloud:login', d),
  cloudLogout: () => ipcRenderer.invoke('cloud:logout'),
  cloudIsLoggedIn: () => ipcRenderer.invoke('cloud:isLoggedIn'),
  cloudTestConnection: () => ipcRenderer.invoke('cloud:testConnection'),
  cloudListFiles: () => ipcRenderer.invoke('cloud:listFiles'),
  cloudBackupFile: (d) => ipcRenderer.invoke('cloud:backupFile', d),
  cloudRestoreFile: (d) => ipcRenderer.invoke('cloud:restoreFile', d),
  cloudDeleteFile: (d) => ipcRenderer.invoke('cloud:deleteFile', d),
  cloudChangePassword: (d) => ipcRenderer.invoke('cloud:changePassword', d),

  // Terminal (local PTY — multi-tab, each call carries ptyId)
  terminalSpawn: () => ipcRenderer.invoke('terminal:spawn'),
  terminalKill: (ptyId) => ipcRenderer.invoke('terminal:kill', { ptyId }),
  terminalSendData: (ptyId, data) => ipcRenderer.send('terminal:input', { ptyId, data }),
  terminalResize: (ptyId, cols, rows) => ipcRenderer.send('terminal:resize', { ptyId, cols, rows }),
  onTerminalData: (cb) => ipcRenderer.on('terminal:output', (_e, { ptyId, data }) => cb(ptyId, data)),
  onTerminalExit: (cb) => ipcRenderer.on('terminal:exit', (_e, { ptyId, exitCode }) => cb(ptyId, exitCode)),
  terminalSaveClipboardImage: () => ipcRenderer.invoke('terminal:saveClipboardImage'),

  // RSS
  rssFetchFeed: (url) => ipcRenderer.invoke('rss:fetchFeed', { url }),
  rssSaveState: (stateJson) => ipcRenderer.invoke('rss:saveState', { stateJson }),
  rssLoadState: () => ipcRenderer.invoke('rss:loadState'),
  openOpmlFile: () => ipcRenderer.invoke('dialog:openOpmlFile'),

  // Smart RSS — semantic ranking + thumbs
  rssSmart: {
    ping:            ()                => ipcRenderer.invoke('smart-rss:call', { type: 'ping' }),
    embedArticles:   (articles)        => ipcRenderer.invoke('smart-rss:call', { type: 'embedArticles', payload: { articles } }),
    listInterests:   ()                => ipcRenderer.invoke('smart-rss:call', { type: 'listInterests' }),
    addInterest:     (name)            => ipcRenderer.invoke('smart-rss:call', { type: 'addInterest', payload: { name } }),
    removeInterest:  (id)              => ipcRenderer.invoke('smart-rss:call', { type: 'removeInterest', payload: { id } }),
    suggestFromOpml: (opmlText)        => ipcRenderer.invoke('smart-rss:call', { type: 'suggestInterestsFromOpml', payload: { opmlText } }),
    score:           (guids)           => ipcRenderer.invoke('smart-rss:call', { type: 'score', payload: { guids } }),
    react:           (guid, kind)      => ipcRenderer.invoke('smart-rss:call', { type: 'react', payload: { guid, kind } }),
    dislikeCentroid: ()                => ipcRenderer.invoke('smart-rss:call', { type: 'getDislikeCentroid' }),
    runPromote:      ()                => ipcRenderer.invoke('smart-rss:call', { type: 'runNightlyPromote' }),
    fetchSource:     (kind, opts)      => ipcRenderer.invoke('smart-rss:call', { type: 'fetchSource', payload: { kind, opts } }),
  },

  // Claude pop-up windows (main-window side — open only)
  openDiffWindow: (opts = {}) => ipcRenderer.invoke('diff:openWindow', opts),
  openPlanWindow: (opts = {}) => ipcRenderer.invoke('plan:openWindow', opts),
  terminalGetContext: (ptyId) => ipcRenderer.invoke('terminal:getContext', { ptyId }),
  onMenuOpenDiffWindow: (cb) => ipcRenderer.on('menu:openDiffWindow', cb),
  onMenuOpenPlanWindow: (cb) => ipcRenderer.on('menu:openPlanWindow', cb),
});

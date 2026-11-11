const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('agy', {
  getTelemetry: () => ipcRenderer.invoke('get-telemetry'),
  getModels: () => ipcRenderer.invoke('get-models'),
  lockPath: (targetPath, reason, convId) => ipcRenderer.invoke('lock-path', { targetPath, reason, convId }),
  unlockPath: (targetPath, convId) => ipcRenderer.invoke('unlock-path', { targetPath, convId }),
  sendMessage: (recipientId, message, title) => ipcRenderer.invoke('send-message', { recipientId, message, title }),
  broadcastMessage: (message, senderId) => ipcRenderer.invoke('broadcast-message', { message, senderId }),
  
  // Embedded In-App Agent Runner (0 external windows)
  startTurn: (data) => ipcRenderer.invoke('start-turn', data),
  cancelTurn: () => ipcRenderer.invoke('cancel-turn'),
  onStreamEvent: (callback) => {
    const subscription = (_, event) => callback(event);
    ipcRenderer.on('stream-event', subscription);
    return () => ipcRenderer.removeListener('stream-event', subscription);
  },
  onTurnFinished: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('turn-finished', subscription);
    return () => ipcRenderer.removeListener('turn-finished', subscription);
  },

  // Audio & Voice Processing
  transcribeAudio: (audioBuffer, mimeType) => ipcRenderer.invoke('transcribe-audio', { audioBuffer, mimeType }),
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
  speakText: (text) => ipcRenderer.invoke('speak-text', { text }),

  // General File Attachments (Any file, images, code, docs)
  selectFiles: () => ipcRenderer.invoke('select-files'),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  getPathForFile: (file) => (webUtils ? webUtils.getPathForFile(file) : (file.path || '')),

  // Workspace Management
  selectWorkspaceDir: () => ipcRenderer.invoke('select-workspace-dir'),
  getCommonWorkspaces: () => ipcRenderer.invoke('get-common-workspaces'),

  // Plugins & MCP
  getMcpStatus: () => ipcRenderer.invoke('get-mcp-status'),
  getPluginsStatus: () => ipcRenderer.invoke('get-plugins-status'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),

  isElectron: true
});

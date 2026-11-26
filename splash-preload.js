const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qgSplash', {
  version: () => ipcRenderer.invoke('version'),
  onProgress: (cb) => ipcRenderer.on('splash-progress', (_e, p) => cb(p))
});

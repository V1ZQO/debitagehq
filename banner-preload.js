const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qgBanner', {
  stop: () => ipcRenderer.send('rc-banner-stop'),
  onText: (cb) => ipcRenderer.on('rc-banner-text', (_e, s) => cb(s))
});

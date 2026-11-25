const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qg', {
  win: (action) => ipcRenderer.invoke('win', action),
  notify: (title, body, view) => ipcRenderer.invoke('notify', { title, body, view }),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  isFocused: () => ipcRenderer.invoke('is-focused'),
  version: () => ipcRenderer.invoke('version'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  updateStatus: () => ipcRenderer.invoke('update-status'),
  onUpdate: (cb) => ipcRenderer.on('update-ready', (_e, v) => cb(v)),
  onNav: (cb) => ipcRenderer.on('nav', (_e, view) => cb(view))
});

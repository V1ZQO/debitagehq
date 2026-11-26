const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('qg', {
  bootProgress: (pct, text) => ipcRenderer.send('boot-progress', { pct, text }),
  bootDone: () => ipcRenderer.send('boot-done'),
  win: (action) => ipcRenderer.invoke('win', action),
  gofileUpload: (file) => { let filePath = ''; try { filePath = webUtils.getPathForFile(file); } catch {} return ipcRenderer.invoke('gofile-upload', { filePath, name: file && file.name }); },
  onGofileProgress: (cb) => { const h = (_e, p) => cb(p); ipcRenderer.on('gofile-progress', h); return () => ipcRenderer.removeListener('gofile-progress', h); },
  getAutoStart: () => ipcRenderer.invoke('get-autostart'),
  setAutoStart: (on) => ipcRenderer.invoke('set-autostart', on),
  rcCapture: (on) => ipcRenderer.invoke('rc-capture', on),
  rcSession: (s) => ipcRenderer.invoke('rc-session', s),
  rcAttention: () => ipcRenderer.invoke('rc-attention'),
  rcInput: (m) => ipcRenderer.send('rc-input', m),
  onRcStop: (cb) => ipcRenderer.on('rc-stop', () => cb()),
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

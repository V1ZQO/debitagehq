// DebitageHQ : processus principal Electron (fenêtre, icône de la zone de notification, notifications)
const { app, BrowserWindow, Tray, Menu, Notification, shell, ipcMain, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

// Nouveau nom : on garde la connexion et les réglages de l'ancienne version « Le QG »
const NEW_DATA = path.join(app.getPath('appData'), 'DebitageHQ');
const OLD_DATA = path.join(app.getPath('appData'), 'Le QG');
try { if (!fs.existsSync(NEW_DATA) && fs.existsSync(OLD_DATA)) fs.cpSync(OLD_DATA, NEW_DATA, { recursive: true }); } catch {}
app.setPath('userData', NEW_DATA);
nativeTheme.themeSource = 'dark';

const ICON = path.join(__dirname, 'app', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'app', 'tray.png');
let win = null, tray = null, quitting = false;

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => showWindow());
app.setAppUserModelId('fr.equipe.leqg');

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function goTo(view) { showWindow(); if (win) win.webContents.send('nav', view); }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    title: 'DebitageHQ', icon: ICON, backgroundColor: '#1e1e1e', autoHideMenuBar: true, show: false, frame: false, roundedCorners: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // Liens externes : toujours dans le navigateur, jamais dans l'appli
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  // Fermer la fenêtre la range dans la zone de notification
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  win.on('focus', () => win.flashFrame(false));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('DebitageHQ');
  const sections = [['accueil', 'Accueil'], ['fichiers', 'Fichiers'], ['taches', 'Tâches'], ['planning', 'Planning'], ['notes', 'Notes & docs'], ['discussion', 'Discussion']];
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir DebitageHQ', click: showWindow },
    { type: 'separator' },
    ...sections.map(([v, l]) => ({ label: l, click: () => goTo(v) })),
    { type: 'separator' },
    { label: 'Rechercher une mise à jour', click: () => { if (win) win.webContents.send('nav', 'equipe'); showWindow(); } },
    { label: 'Quitter DebitageHQ', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
}

ipcMain.handle('notify', (_e, { title, body, view }) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({ title: String(title || 'DebitageHQ').slice(0, 80), body: String(body || '').slice(0, 300), icon: ICON });
  n.on('click', () => goTo(typeof view === 'string' ? view : 'accueil'));
  n.show();
  if (win && !win.isFocused()) win.flashFrame(true);
  return true;
});
ipcMain.handle('win', (_e, action) => {
  if (!win) return;
  if (action === 'close') win.hide();            // range l'appli dans la zone de notification
  else if (action === 'min') win.minimize();
  else if (action === 'max') { if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
});
ipcMain.handle('open-external', (_e, url) => { if (typeof url === 'string' && /^https:\/\//.test(url)) { shell.openExternal(url); return true; } return false; });
ipcMain.handle('is-focused', () => !!(win && win.isVisible() && win.isFocused()));
ipcMain.handle('version', () => app.getVersion());

// ---------- Mises à jour automatiques (publiées sur GitHub Releases) ----------
let updateReady = null, checking = false;
function setupUpdates() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = info && info.version;
    if (win) win.webContents.send('update-ready', updateReady);
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Mise à jour prête', body: `DebitageHQ ${updateReady} est prête. Redémarre l'appli pour l'installer.`, icon: ICON });
      n.on('click', showWindow); n.show();
    }
  });
  autoUpdater.on('error', () => { checking = false; });
  autoUpdater.on('update-not-available', () => { checking = false; });
  const check = () => { if (checking || updateReady) return; checking = true; autoUpdater.checkForUpdates().catch(() => {}).finally(() => { checking = false; }); };
  ipcMain.handle('install-update', () => { if (!updateReady) return false; quitting = true; setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; });
  ipcMain.handle('check-updates', () => { check(); return true; });
  ipcMain.handle('update-status', () => updateReady);
  setTimeout(check, 8000);
  setInterval(check, 60 * 60 * 1000);
}
if (!app.isPackaged) {
  ipcMain.handle('install-update', () => false);
  ipcMain.handle('check-updates', () => false);
  ipcMain.handle('update-status', () => null);
}

app.whenReady().then(() => { createWindow(); createTray(); setupUpdates(); });
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* reste dans la zone de notification */ });

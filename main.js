// DebitageHQ : processus principal Electron (fenêtre, icône de la zone de notification, notifications)
const { app, BrowserWindow, Tray, Menu, Notification, shell, ipcMain, nativeImage, nativeTheme, desktopCapturer, session, screen } = require('electron');
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
let win = null, tray = null, quitting = false, splash = null, splashStart = 0, booted = false;
// Au lancement, on vérifie les mises à jour avant d'ouvrir l'appli (« portail »).
let gateDone = !app.isPackaged, bootWanted = false, updatingNow = false;
function openGate() { if (gateDone) return; gateDone = true; if (bootWanted) finishBoot(); }

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => showWindow());
app.setAppUserModelId('fr.equipe.leqg');

function showWindow() {
  if (!win || !booted) return;
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
  // Liens externes : toujours dans le navigateur, jamais dans l'appli
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  // Fermer la fenêtre la range dans la zone de notification
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  win.on('focus', () => win.flashFrame(false));
}

// ---------- Écran de chargement ----------
function createSplash() {
  splashStart = Date.now();
  splash = new BrowserWindow({
    width: 440, height: 340, frame: false, transparent: true, resizable: false, movable: true, show: false,
    skipTaskbar: false, alwaysOnTop: true, center: true, title: 'DebitageHQ', icon: ICON, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'splash-preload.js'), contextIsolation: true, sandbox: true }
  });
  splash.loadFile(path.join(__dirname, 'app', 'splash.html'));
  splash.once('ready-to-show', () => splash.show());
  splash.webContents.once('did-finish-load', () => { if (!gateDone && !updatingNow) splashProgress(12, 'Recherche de mises à jour…'); });
  splash.on('closed', () => { splash = null; });
  setTimeout(() => { if (!updatingNow) { openGate(); finishBoot(); } }, 15000); // sécurité : on ouvre l'appli quoi qu'il arrive
}
function splashProgress(pct, text) { if (splash && !splash.isDestroyed()) splash.webContents.send('splash-progress', { pct, text }); }
function finishBoot() {
  bootWanted = true;
  if (booted || !gateDone || updatingNow) return; booted = true;
  const wait = Math.max(0, 2200 - (Date.now() - splashStart)); // laisse le temps de voir l'animation
  setTimeout(() => {
    splashProgress(100, 'Prêt');
    setTimeout(() => {
      if (win) { win.show(); win.focus(); }
      if (splash && !splash.isDestroyed()) splash.close();
    }, 380);
  }, wait);
}
ipcMain.on('boot-progress', (_e, p) => { if (!updatingNow && gateDone && p && typeof p.pct === 'number') splashProgress(p.pct, typeof p.text === 'string' ? p.text : ''); });
ipcMain.on('boot-done', () => finishBoot());

function createTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('DebitageHQ');
  const sections = [['accueil', 'Accueil'], ['fichiers', 'Fichiers'], ['taches', 'Tâches'], ['planning', 'Planning'], ['notes', 'Notes & docs'], ['discussion', 'Discussion']];
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir DebitageHQ', click: showWindow },
    { type: 'separator' },
    ...sections.map(([v, l]) => ({ label: l, click: () => goTo(v) })),
    { type: 'separator' },
    { label: 'Rechercher une mise à jour', click: () => { if (win) win.webContents.send('nav', 'parametres'); showWindow(); } },
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
// ---------- Envoi des gros fichiers sur Gofile ----------
// Le fichier est lu par morceaux depuis le disque et envoyé en flux : pas de limite de taille, pas de mémoire saturée.
const https = require('https');
ipcMain.handle('gofile-upload', async (e, { filePath, name }) => {
  try {
    if (typeof filePath !== 'string' || !filePath || !fs.existsSync(filePath)) return { ok: false, error: 'fichier introuvable sur le disque' };
    const st = fs.statSync(filePath);
    if (!st.isFile()) return { ok: false, error: "ce n'est pas un fichier" };
    const fname = String(name || path.basename(filePath)).replace(/["\r\n\\]/g, '_').slice(0, 200) || 'fichier';
    const boundary = '----DebitageHQ' + Math.random().toString(16).slice(2);
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fname}"\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf8');
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const total = head.length + st.size + tail.length;
    return await new Promise((resolve) => {
      const req = https.request({ method: 'POST', host: 'upload.gofile.io', path: '/uploadfile', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': total, 'User-Agent': 'DebitageHQ' } }, (res) => {
        let body = ''; res.setEncoding('utf8');
        res.on('data', (c) => { if (body.length < 100000) body += c; });
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            const url = j && j.data && j.data.downloadPage;
            if (j.status === 'ok' && typeof url === 'string') resolve({ ok: true, url });
            else resolve({ ok: false, error: `Gofile a refusé l'envoi (${(j && j.status) || res.statusCode})` });
          } catch { resolve({ ok: false, error: `réponse illisible de Gofile (code ${res.statusCode})` }); }
        });
      });
      req.on('error', (err) => resolve({ ok: false, error: 'connexion impossible à Gofile : ' + err.message }));
      req.setTimeout(10 * 60 * 1000, () => req.destroy(new Error('délai dépassé')));
      let sent = 0, lastPct = -1;
      const tick = (n) => { sent += n; const pct = Math.min(99, Math.floor(sent / total * 100)); if (pct !== lastPct) { lastPct = pct; if (!e.sender.isDestroyed()) e.sender.send('gofile-progress', { name, pct }); } };
      req.write(head); tick(head.length);
      const rs = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
      rs.on('data', (chunk) => { tick(chunk.length); if (!req.write(chunk)) { rs.pause(); req.once('drain', () => rs.resume()); } });
      rs.on('end', () => { req.end(tail); });
      rs.on('error', (err) => { req.destroy(err); resolve({ ok: false, error: 'lecture du fichier impossible : ' + err.message }); });
    });
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

// ---------- Contrôle à distance ----------
// Capture d'écran : autorisée uniquement juste après que la personne a cliqué « Accepter ».
let rcCaptureOk = false, rcActive = false, rcControl = false, rcBanner = null, rcDisplay = null;
const rcKeysDown = new Set(), rcButtonsDown = new Set();
function setupCapture() {
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
    if (!rcCaptureOk) return cb({});
    rcCaptureOk = false;
    desktopCapturer.getSources({ types: ['screen'] }).then((srcs) => {
      const prim = screen.getPrimaryDisplay();
      const src = srcs.find((s) => String(s.display_id) === String(prim.id)) || srcs[0];
      rcDisplay = (src && screen.getAllDisplays().find((d) => String(d.id) === String(src.display_id))) || prim;
      cb(src ? { video: src } : {});
    }).catch(() => cb({}));
  });
}
ipcMain.handle('rc-capture', (_e, on) => { rcCaptureOk = !!on; return true; });
ipcMain.handle('rc-attention', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.flashFrame(true); } return true; });
ipcMain.handle('rc-session', (_e, s) => {
  rcActive = !!(s && s.active); rcControl = rcActive && !!s.control;
  if (!rcActive) { releaseAll(); if (rcBanner && !rcBanner.isDestroyed()) rcBanner.close(); rcBanner = null; return true; }
  const text = `${String(s.name || 'Quelqu\'un').slice(0, 30)} ${rcControl ? 'contrôle ton PC' : 'voit ton écran'}`;
  if (!rcBanner || rcBanner.isDestroyed()) {
    const wa = screen.getPrimaryDisplay().workArea;
    rcBanner = new BrowserWindow({ width: 420, height: 48, x: Math.round(wa.x + wa.width / 2 - 210), y: wa.y + 8, frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, focusable: true, show: false, backgroundColor: '#00000000', webPreferences: { preload: path.join(__dirname, 'banner-preload.js'), contextIsolation: true, sandbox: true } });
    rcBanner.setAlwaysOnTop(true, 'screen-saver');
    rcBanner.loadFile(path.join(__dirname, 'app', 'banner.html'));
    rcBanner.once('ready-to-show', () => { rcBanner.showInactive(); rcBanner.webContents.send('rc-banner-text', text); });
    rcBanner.on('closed', () => { rcBanner = null; });
  } else rcBanner.webContents.send('rc-banner-text', text);
  return true;
});
ipcMain.on('rc-banner-stop', () => { rcActive = false; rcControl = false; releaseAll(); if (win) win.webContents.send('rc-stop'); if (rcBanner && !rcBanner.isDestroyed()) rcBanner.close(); });

// Souris et clavier (Windows) : uniquement pendant une session acceptée avec le contrôle autorisé.
let W32 = null;
function w32() {
  if (W32 !== null) return W32;
  W32 = false;
  if (process.platform !== 'win32') return W32;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const MOUSEINPUT = koffi.struct('MOUSEINPUT', { dx: 'int32', dy: 'int32', mouseData: 'uint32', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr' });
    const KEYBDINPUT = koffi.struct('KEYBDINPUT', { wVk: 'uint16', wScan: 'uint16', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr' });
    const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', { uMsg: 'uint32', wParamL: 'uint16', wParamH: 'uint16' });
    const INPUT = koffi.struct('INPUT', { type: 'uint32', u: koffi.union('INPUT_U', { mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT }) });
    const SendInput = user32.func('uint32 __stdcall SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)');
    const SetCursorPos = user32.func('bool __stdcall SetCursorPos(int X, int Y)');
    const size = koffi.sizeof(INPUT);
    W32 = {
      move: (x, y) => SetCursorPos(x, y),
      mouse: (flags, data = 0) => SendInput(1, [{ type: 0, u: { mi: { dx: 0, dy: 0, mouseData: data >>> 0, dwFlags: flags, time: 0, dwExtraInfo: 0 } } }], size),
      key: (scan, ext, up) => SendInput(1, [{ type: 1, u: { ki: { wVk: 0, wScan: scan, dwFlags: 0x0008 | (ext ? 0x0001 : 0) | (up ? 0x0002 : 0), time: 0, dwExtraInfo: 0 } } }], size)
    };
  } catch (err) { console.error('contrôle à distance indisponible :', err); W32 = false; }
  return W32;
}
// Touches physiques (codes de position) : la même touche est pressée chez l'autre, quelle que soit la disposition du clavier.
const SC = { Escape: 0x01, Digit1: 0x02, Digit2: 0x03, Digit3: 0x04, Digit4: 0x05, Digit5: 0x06, Digit6: 0x07, Digit7: 0x08, Digit8: 0x09, Digit9: 0x0A, Digit0: 0x0B, Minus: 0x0C, Equal: 0x0D, Backspace: 0x0E, Tab: 0x0F,
  KeyQ: 0x10, KeyW: 0x11, KeyE: 0x12, KeyR: 0x13, KeyT: 0x14, KeyY: 0x15, KeyU: 0x16, KeyI: 0x17, KeyO: 0x18, KeyP: 0x19, BracketLeft: 0x1A, BracketRight: 0x1B, Enter: 0x1C, ControlLeft: 0x1D,
  KeyA: 0x1E, KeyS: 0x1F, KeyD: 0x20, KeyF: 0x21, KeyG: 0x22, KeyH: 0x23, KeyJ: 0x24, KeyK: 0x25, KeyL: 0x26, Semicolon: 0x27, Quote: 0x28, Backquote: 0x29, ShiftLeft: 0x2A, Backslash: 0x2B,
  KeyZ: 0x2C, KeyX: 0x2D, KeyC: 0x2E, KeyV: 0x2F, KeyB: 0x30, KeyN: 0x31, KeyM: 0x32, Comma: 0x33, Period: 0x34, Slash: 0x35, ShiftRight: 0x36, NumpadMultiply: 0x37, AltLeft: 0x38, Space: 0x39, CapsLock: 0x3A,
  F1: 0x3B, F2: 0x3C, F3: 0x3D, F4: 0x3E, F5: 0x3F, F6: 0x40, F7: 0x41, F8: 0x42, F9: 0x43, F10: 0x44, NumLock: 0x45, ScrollLock: 0x46, Numpad7: 0x47, Numpad8: 0x48, Numpad9: 0x49, NumpadSubtract: 0x4A,
  Numpad4: 0x4B, Numpad5: 0x4C, Numpad6: 0x4D, NumpadAdd: 0x4E, Numpad1: 0x4F, Numpad2: 0x50, Numpad3: 0x51, Numpad0: 0x52, NumpadDecimal: 0x53, IntlBackslash: 0x56, F11: 0x57, F12: 0x58 };
const SCX = { NumpadEnter: 0x1C, ControlRight: 0x1D, NumpadDivide: 0x35, AltRight: 0x38, Home: 0x47, ArrowUp: 0x48, PageUp: 0x49, ArrowLeft: 0x4B, ArrowRight: 0x4D, End: 0x4F, ArrowDown: 0x50, PageDown: 0x51, Insert: 0x52, Delete: 0x53, MetaLeft: 0x5B, MetaRight: 0x5C, ContextMenu: 0x5D };
const BTN = { 0: [0x0002, 0x0004], 1: [0x0020, 0x0040], 2: [0x0008, 0x0010] };
function keyEvent(code, up) { const w = w32(); if (!w) return; if (code in SC) w.key(SC[code], false, up); else if (code in SCX) w.key(SCX[code], true, up); else return; if (up) rcKeysDown.delete(code); else rcKeysDown.add(code); }
function releaseAll() { const w = w32(); if (!w) return; for (const c of [...rcKeysDown]) keyEvent(c, true); for (const b of [...rcButtonsDown]) { w.mouse(BTN[b][1]); rcButtonsDown.delete(b); } }
ipcMain.on('rc-input', (_e, m) => {
  if (!rcActive || !rcControl || !m || typeof m !== 'object') return;
  const w = w32(); if (!w) return;
  const d = rcDisplay || screen.getPrimaryDisplay();
  if ((m.t === 'mm' || m.t === 'md' || m.t === 'mu') && Number.isFinite(m.x) && Number.isFinite(m.y)) {
    const x = Math.min(1, Math.max(0, m.x)), y = Math.min(1, Math.max(0, m.y));
    const p = screen.dipToScreenPoint({ x: d.bounds.x + x * d.bounds.width, y: d.bounds.y + y * d.bounds.height });
    w.move(Math.round(p.x), Math.round(p.y));
  }
  if ((m.t === 'md' || m.t === 'mu') && BTN[m.b]) { w.mouse(BTN[m.b][m.t === 'md' ? 0 : 1]); if (m.t === 'md') rcButtonsDown.add(m.b); else rcButtonsDown.delete(m.b); }
  else if (m.t === 'wh' && Number.isFinite(m.dy)) w.mouse(0x0800, Math.max(-1200, Math.min(1200, Math.round(-m.dy))));
  else if ((m.t === 'kd' || m.t === 'ku') && typeof m.code === 'string') keyEvent(m.code, m.t === 'ku');
  else if (m.t === 'rel') releaseAll();
});

ipcMain.handle('open-external', (_e, url) => { if (typeof url === 'string' && /^https:\/\//.test(url)) { shell.openExternal(url); return true; } return false; });
ipcMain.handle('is-focused', () => !!(win && win.isVisible() && win.isFocused()));
ipcMain.handle('version', () => app.getVersion());

// ---------- Lancement au démarrage de Windows (activé par défaut) ----------
const PREFS = () => path.join(app.getPath('userData'), 'prefs.json');
function readPrefs() { try { return JSON.parse(fs.readFileSync(PREFS(), 'utf8')) || {}; } catch { return {}; } }
function writePrefs(p) { try { fs.writeFileSync(PREFS(), JSON.stringify(p)); } catch {} }
function applyAutoStart(on) { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!on, path: process.execPath }); }
ipcMain.handle('get-autostart', () => readPrefs().autoStart !== false);
ipcMain.handle('set-autostart', (_e, on) => { const p = readPrefs(); p.autoStart = !!on; writePrefs(p); applyAutoStart(!!on); return !!on; });

// ---------- Mises à jour automatiques (publiées sur GitHub Releases) ----------
let updateReady = null, checking = false;
function setupUpdates() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Mise à jour trouvée au lancement : on l'installe tout de suite, sur l'écran de chargement.
  let startVer = '';
  const gateTimer = setTimeout(openGate, 7000); // GitHub ne répond pas : on ouvre l'appli
  autoUpdater.on('update-available', (info) => {
    if (gateDone) return;
    clearTimeout(gateTimer); updatingNow = true; startVer = String((info && info.version) || '');
    splashProgress(15, `Mise à jour vers la v${startVer}…`);
    setTimeout(() => { if (updatingNow) { updatingNow = false; openGate(); } }, 4 * 60 * 1000); // trop long : on ouvre, elle s'installera à la fermeture
  });
  autoUpdater.on('download-progress', (p) => { if (updatingNow && p) splashProgress(15 + Math.round((p.percent || 0) * 0.8), `Mise à jour vers la v${startVer}… ${Math.round(p.percent || 0)} %`); });
  autoUpdater.on('update-not-available', () => { clearTimeout(gateTimer); openGate(); });
  autoUpdater.on('error', () => { clearTimeout(gateTimer); updatingNow = false; openGate(); });
  autoUpdater.on('update-downloaded', (info) => {
    if (updatingNow) { splashProgress(100, 'Installation de la mise à jour…'); quitting = true; setTimeout(() => autoUpdater.quitAndInstall(true, true), 700); return; }
    updateReady = info && info.version;
    if (win) win.webContents.send('update-ready', updateReady);
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Mise à jour prête', body: `DebitageHQ ${updateReady} est prête. Redémarre l'appli pour l'installer.`, icon: ICON });
      n.on('click', showWindow); n.show();
    }
  });
  const check = () => { if (checking || updateReady) return; checking = true; autoUpdater.checkForUpdates().catch(() => {}).finally(() => { checking = false; }); };
  ipcMain.handle('install-update', () => { if (!updateReady) return false; quitting = true; setImmediate(() => autoUpdater.quitAndInstall(true, true)); return true; });
  ipcMain.handle('check-updates', () => { check(); return true; });
  ipcMain.handle('update-status', () => updateReady);
  check();
  setInterval(check, 60 * 60 * 1000);
}
if (!app.isPackaged) {
  ipcMain.handle('install-update', () => false);
  ipcMain.handle('check-updates', () => false);
  ipcMain.handle('update-status', () => null);
}

app.whenReady().then(() => { applyAutoStart(readPrefs().autoStart !== false); createSplash(); setupCapture(); createWindow(); createTray(); setupUpdates(); });
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* reste dans la zone de notification */ });

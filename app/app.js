'use strict';
{
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const QG = window.qg || { rcCapture: async () => true, rcSession: async () => true, rcAttention: async () => true, rcInput: () => {}, onRcStop: () => {}, getAutoStart: async () => false, setAutoStart: async v => v, gofileUpload: async () => ({ ok: false }), onGofileProgress: () => null, bootProgress: () => {}, bootDone: () => {}, installUpdate: async () => false, checkUpdates: async () => false, updateStatus: async () => null, onUpdate: () => {}, win: () => {}, notify: async () => {}, openExternal: async u => window.open(u), isFocused: async () => document.hasFocus(), version: async () => 'dev', onNav: () => {} };

// ---------- État ----------
const CFG_KEY = 'qg.config';
let cfg = loadCfg(), sb = null, me = null, phase = 'boot', authTab = 'login', authMsg = '';
const S = { task_notes: [], files: [], tasks: [], events: [], notes: [], messages: [], dms: [], notifications: [], reactions: [], ideas: [], ai_chats: [] };
let ideasReady = true, aiReady = false, aiBusy = false, aiKey = '', aiModel = 'gemini-2.0-flash';
let tnReady = true, profReady = true, noteMode = 'edit', noteLive = null, reactReady = true, presMeta = {}, myStatus = (() => { try { return localStorage.getItem('qg.status') || 'dispo' } catch { return 'dispo' } })();
let notifReady = true, soundOn = (() => { try { return localStorage.getItem('qg.sound') !== '0' } catch { return true } })();
let autoStart = true, online = new Set(), pres = null, dmReady = true, dmOpen = (() => { try { return localStorage.getItem('qg.dm') !== '0' } catch { return true } })(), dmWith = null, dmDraft = '';
let members = []; const names = {}; const thumbs = {};
const VIEWS = ['accueil', 'fichiers', 'taches', 'planning', 'notes', 'discussion', 'idees', 'assistant', 'equipe', 'remote', 'parametres', 'notifications'];
const SPACES = { serveur: { label: 'Serveur GTA 6', sub: 'Développement' }, cheat: { label: 'Cheat', sub: 'Projet cheat' }, youtube: { label: 'YouTube', sub: 'Chaîne' } };
let space = 'serveur', spaceReady = true;
const spOf = r => (r && r.space) || 'serveur';
const SP = t => S[t].filter(r => spOf(r) === space);   // données de l'espace affiché
const GLOBAL = ['equipe', 'remote', 'parametres', 'notifications'];
const hrefOf = v => GLOBAL.includes(v) ? '#' + v : `#${space}-${v}`;
let view = 'accueil', fileFolder = 'Tous', fileQ = '', noteQ = '', taskMine = false, noteSel = null, uploading = [], version = '';
// Catégories propres à chaque espace
const CATS = {
  serveur: {
    folders: ['Scripts', 'Maps', 'Visuels', 'Véhicules', 'Docs', 'Audio', 'Autre'],
    ttags: ['Script', 'Map', 'Interface', 'Lore', 'Économie', 'Bug', 'Autre'],
    ntags: ['Idée', 'Code', 'Lore', 'Règles', 'Réunion', 'Autre'],
    filesSub: "Scripts, maps, visuels et liens partagés par l'équipe.",
    notesSub: 'Lore, règles, idées et documentation technique.',
    notesHint: 'idée de script, règle du serveur, morceau de lore, architecture',
    taskEx: 'Ex. Script de permis de conduire'
  },
  cheat: {
    folders: ['Builds', 'Sources', 'Offsets', 'Bypass', 'Configs', 'Menu / UI', 'Outils', 'Docs', 'Autre'],
    ttags: ['Fonctionnalité', 'Menu / UI', 'Mise à jour', 'Bug', 'Test', 'Release', 'Autre'],
    ntags: ['Idée', 'Code', 'Recherche', 'Changelog', 'Réunion', 'Autre'],
    filesSub: "Builds, sources, offsets et configs partagés par l'équipe.",
    notesSub: 'Idées, recherches, changelogs et documentation technique.',
    notesHint: 'idée de fonctionnalité, recherche, changelog, architecture',
    taskEx: 'Ex. Nouvelle option du menu'
  },
  youtube: {
    folders: ['Rushs', 'Audio', 'Musiques', 'Miniatures', 'Montages', 'Scripts vidéo', 'Docs', 'Autre'],
    ttags: ['Tournage', 'Montage', 'Miniature', 'Idée', 'Publication', 'Autre'],
    ntags: ['Idée', 'Script', 'Recherche', 'Planning', 'Réunion', 'Autre'],
    filesSub: "Rushs, audio, musiques, miniatures et montages de la chaîne.",
    notesSub: 'Idées, scripts et notes pour les vidéos.',
    notesHint: 'idée de vidéo, script, plan de tournage',
    taskEx: 'Ex. Faire la miniature de la vidéo braquage'
  }
};
const C = () => CATS[space] || CATS.serveur;
const ST = [['todo', 'À faire'], ['doing', 'En cours'], ['done', 'Terminé']];
const MAX = 50 * 1048576;

function loadCfg() { try { const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); return c && c.u && c.k && c.s ? c : null } catch { return null } }
function saveCfg(c) { cfg = c; try { c ? localStorage.setItem(CFG_KEY, JSON.stringify(c)) : localStorage.removeItem(CFG_KEY) } catch {} }
const makeCode = c => 'QG1.' + btoa(unescape(encodeURIComponent(JSON.stringify(c.w ? { u: c.u, k: c.k, s: c.s, w: c.w } : { u: c.u, k: c.k, s: c.s }))));
const okWorker = w => typeof w === 'string' && /^https:\/\/[a-z0-9.-]+\.workers\.dev\/?$/i.test(w);
function parseCode(t) {
  t = String(t || '').replace(/\s+/g, '');
  if (!t.startsWith('QG1.')) return null;
  try { const o = JSON.parse(decodeURIComponent(escape(atob(t.slice(4))))); return okCfg(o) ? o : null } catch { return null }
}
const okCfg = o => o && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(o.u) && typeof o.k === 'string' && o.k.length > 20 && typeof o.s === 'string' && o.s.length >= 6 && (o.w == null || okWorker(o.w));

// ---------- Utilitaires ----------
const ts = t => typeof t === 'number' ? t : Date.parse(t || '') || 0;
const ago = t => { t = ts(t); if (!t) return ''; const s = (Date.now() - t) / 1000; if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.floor(s / 60)} min`; if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`; if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`; return new Date(t).toLocaleDateString('fr-FR') };
const size = b => { b = Number(b); return !b ? '' : b < 1024 ? b + ' o' : b < 1048576 ? Math.round(b / 1024) + ' Ko' : (b / 1048576).toFixed(1) + ' Mo' };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const fmtDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if (!m) return { d: '?', m: '', w: '' }; const d = new Date(+m[1], m[2] - 1, +m[3]); return { d: m[3], m: d.toLocaleDateString('fr-FR', { month: 'short' }), w: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) } };
const nm = id => (typeof id === 'string' && names[id]) || 'Quelqu’un';
const opts = (a, sel) => a.map(o => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');
const isId = x => typeof x === 'string' && x.length > 0 && x.length < 100;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3600) }
function errMsg(e) {
  const m = String(e && (e.message || e.error_description) || '');
  if (/Invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered/i.test(m)) return 'Ce compte existe déjà : connecte-toi.';
  if (/Email not confirmed/i.test(m)) return 'Confirme d’abord ton e-mail (regarde ta boîte de réception).';
  if (/Password should/i.test(m)) return 'Mot de passe trop court (6 caractères minimum).';
  if (/row-level security|permission/i.test(m)) return 'Accès refusé : tu ne fais pas partie de l’équipe.';
  if (/exceeded|too large|maximum allowed size/i.test(m)) return 'Fichier trop gros ou espace plein.';
  if (/fetch|network/i.test(m)) return 'Pas de connexion au serveur. Vérifie ta connexion Internet.';
  return 'Erreur : ' + (m || 'inconnue');
}
async function w(builder) { try { const { error } = await builder; if (error) { toast(errMsg(error)); return false } return true } catch (e) { toast(errMsg(e)); return false } }
const W = (t, b) => w(b).then(ok => { if (ok) reload(t); return ok });
const fileUrl = f => (f.kind === 'link' || f.kind === 'gofile') ? (typeof f.url === 'string' && f.url.startsWith('https://') ? f.url : null) : null;

// ---------- Connexion au serveur ----------
async function boot() {
  QG.bootProgress(30, 'Préparation…');
  version = await QG.version().catch(() => '');
  autoStart = await QG.getAutoStart().catch(() => false);
  if (!cfg) { phase = 'setup'; QG.bootDone(); return render(true) }
  QG.bootProgress(45, 'Connexion au serveur…');
  sb = window.supabase.createClient(cfg.u.replace(/\/$/, ''), cfg.k, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'qg.auth' } });
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { phase = cfg ? 'auth' : 'setup'; render(true) } });
  const { data } = await sb.auth.getSession();
  if (data && data.session) await enter(data.session.user); else { phase = 'auth'; QG.bootDone(); render(true) }
}
async function enter(u) {
  me = u.id; phase = 'joining'; render(true); QG.bootProgress(60, 'Vérification du compte…');
  const { data: rows, error } = await sb.from('members').select('user_id,name').eq('user_id', me);
  if (error) { phase = 'auth'; authMsg = errMsg(error); QG.bootDone(); return render(true) }
  if (!rows || !rows.length) {
    const nameGuess = (u.user_metadata && u.user_metadata.name) || String(u.email || '').split('@')[0];
    const { data: ok, error: e2 } = await sb.rpc('join_team', { code: cfg.s, display_name: nameGuess });
    if (e2 || !ok) { QG.bootDone(); await sb.auth.signOut(); authMsg = e2 ? errMsg(e2) : "Le code secret de l'équipe est incorrect. Redemande un code d'invitation."; phase = 'auth'; return render(true) }
  }
  QG.bootProgress(75, 'Chargement des données…');
  await Promise.all([loadMembers(), ...Object.keys(S).map(loadTable)]);
  { const { error: se } = await sb.from('files').select('space').limit(1); spaceReady = !se }
  try { const { data: cfgRows, error: ce } = await sb.from('app_config').select('key,value'); if (!ce && cfgRows) { const mp = Object.fromEntries(cfgRows.map(r => [r.key, r.value])); aiKey = mp.gemini_key || ''; aiModel = mp.gemini_model || 'gemini-2.0-flash'; aiReady = !!aiKey } } catch {}
  QG.bootProgress(95, 'Presque prêt…');
  phase = 'app'; route();
  subscribe();
  QG.bootDone();
}
const QUERIES = {
  files: () => sb.from('files').select('*').order('at', { ascending: false }).limit(500),
  tasks: () => sb.from('tasks').select('*').order('at', { ascending: false }).limit(500),
  events: () => sb.from('events').select('*').order('ev_date', { ascending: true }).limit(300),
  notes: () => sb.from('notes').select('*').order('upd', { ascending: false }).limit(500),
  messages: () => sb.from('messages').select('*').order('at', { ascending: false }).limit(150),
  dms: () => sb.from('dms').select('*').order('at', { ascending: false }).limit(1000),
  notifications: () => sb.from('notifications').select('*').order('at', { ascending: false }).limit(200),
  reactions: () => sb.from('reactions').select('*').order('at', { ascending: false }).limit(3000),
  task_notes: () => sb.from('task_notes').select('*').order('at', { ascending: true }).limit(3000),
  ideas: () => sb.from('ideas').select('*').order('at', { ascending: false }).limit(500),
  ai_chats: () => sb.from('ai_chats').select('*').order('at', { ascending: true }).limit(400)
};
async function loadTable(t) { const { data, error } = await QUERIES[t](); if (t === 'dms') dmReady = !error; if (t === 'notifications') notifReady = !error; if (t === 'reactions') reactReady = !error; if (t === 'ideas') ideasReady = !error; if (t === 'task_notes') { tnReady = !error; if (!error) setTimeout(refreshTn) } if (!error) { S[t] = data || []; if (t === 'files') refreshThumbs(); if (t === 'messages' || t === 'dms') ensureImgs(); if (t === 'dms') markRead(); render() } }
async function loadMembers() { let { data, error } = await sb.from('members').select('user_id,name,joined_at,last_seen,avatar,role,bio').order('name'); profReady = !error; if (error) ({ data, error } = await sb.from('members').select('user_id,name,joined_at,last_seen').order('name')); if (error) ({ data, error } = await sb.from('members').select('user_id,name,joined_at').order('name')); if (!error) { members = data || []; members.forEach(m => names[m.user_id] = m.name); render(); ensureAvatars() } }
const timers = {};
function reload(t) { clearTimeout(timers[t]); timers[t] = setTimeout(() => t === 'members' ? loadMembers() : S[t] && loadTable(t), 250) }
let channel = null;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('qg-live').on('postgres_changes', { event: '*', schema: 'public' }, p => { reload(p.table); if (p.eventType === 'INSERT') onInsert(p.table, p.new) }).subscribe();
  setInterval(() => { Object.keys(S).forEach(reload); reload('members'); touchSeen() }, 120000);
  startPresence(); touchSeen(); rcListen();
}
// ---------- Présence en ligne ----------
function startPresence() {
  if (pres) sb.removeChannel(pres);
  pres = sb.channel('qg-presence', { config: { presence: { key: me } } });
  pres.on('presence', { event: 'sync' }, () => { const st = pres.presenceState(); online = new Set(Object.keys(st)); presMeta = {}; for (const k in st) presMeta[k] = (st[k] && st[k][0]) || {}; renderDM(); renderMe(); if (['equipe', 'remote'].includes(view) && $('#modal').hidden) render() })
    .subscribe(async (s) => { if (s === 'SUBSCRIBED') { try { await pres.track({ at: Date.now(), status: myStatus }) } catch {} } });
}
function touchSeen() { if (sb && me) sb.from('members').update({ last_seen: new Date().toISOString() }).eq('user_id', me).then(() => {}, () => {}) }
window.addEventListener('beforeunload', touchSeen);
async function onInsert(t, d) {
  if (t === 'dms') {
    if (!d || d.recipient !== me) return;
    const focused = await QG.isFocused();
    if (focused && dmOpen && dmWith === d.sender) return;
    ping('msg');
    alert2('Message privé de ' + nm(d.sender), bodyOf(d), 'dm:' + d.sender);
    return;
  }
  if (t === 'notifications') {
    if (!d || d.recipient !== me) return;
    ping('task');
    alert2(`${nm(d.actor)} t'a assigné une tâche`, String(d.title || ''), 'notifications');
    return;
  }
  if (t === 'messages' && d && d.author !== me) {
    const focused = await QG.isFocused();
    if (!(focused && view === 'discussion' && space === spOf(d))) ping('msg');
  }
  if (!d || d.author === me || await QG.isFocused()) return;
  const sv = v => `${spOf(d)}-${v}`, tag = spOf(d) === 'cheat' ? '[Cheat] ' : '[Serveur] ';
  if (t === 'messages') alert2(tag + nm(d.author), bodyOf(d), sv('discussion'));
  else if (t === 'files') alert2(tag + 'Nouveau fichier', `${nm(d.author)} a partagé « ${String(d.name || '')} »`, sv('fichiers'));
  else if (t === 'events') alert2(tag + 'Nouveau rendez-vous', `${String(d.title || '')}, ${fmtDate(d.ev_date).w}`, sv('planning'));
}
async function refreshThumbs() {
  const now = Date.now();
  const todo = S.files.filter(f => f.kind === 'upload' && f.path && /^image\//.test(String(f.type || '')) && !(thumbs[f.path] && thumbs[f.path].exp > now));
  const paths = todo.map(f => f.path).slice(0, 100);
  if (!paths.length) return;
  const { data } = await sb.storage.from('files').createSignedUrls(paths, 3600);
  (data || []).forEach(r => { if (r.signedUrl && r.path) thumbs[r.path] = { url: r.signedUrl, exp: now + 3300000 } });
  render();
}

// ---------- Écrans d'accès ----------
function vSetup() {
  return `<section class="gate"><div class="brand"><img class="logo" src="logo.png" alt="">DebitageHQ</div><div class="box"><h2 style="font-size:18px">Rejoindre l'équipe</h2>
<p class="sub">Colle le code d'invitation que t'a envoyé ton équipe.</p>
<form id="joinf"><label>Code d'invitation<textarea id="jcode" name="code" rows="4" required placeholder="QG1.eyJ1Ijoi…"></textarea></label><button class="pri">Continuer</button></form>
<details><summary>Je crée l'équipe (première installation)</summary>
<form id="adminf" style="margin-top:10px"><p class="sub">Dans Supabase : Project Settings &gt; Data API pour l'URL, et Project Settings &gt; API Keys pour la clé. Suis le guide fourni avec l'application.</p>
<label>Project URL<input id="au" name="u" required placeholder="https://xxxx.supabase.co"></label>
<label>Clé publique (publishable ou anon)<input id="ak" name="k" required placeholder="sb_publishable_… ou eyJhbGciOi…"></label>
<label>Code secret de l'équipe (celui du script SQL)<input id="as" name="s" required></label>
<button class="pri">Créer l'équipe</button></form></details></div></section>`
}
function vAuth() {
  const login = authTab === 'login';
  return `<section class="gate"><div class="brand"><img class="logo" src="logo.png" alt="">DebitageHQ</div><div class="box"><h2 style="font-size:18px">${login ? 'Connexion' : 'Créer mon compte'}</h2>
<div class="seg"><button data-act="atab" data-id="login" class="${login ? 'on' : ''}">Se connecter</button><button data-act="atab" data-id="signup" class="${login ? '' : 'on'}">Créer mon compte</button></div>
${authMsg ? `<div class="notice">${esc(authMsg)}</div>` : ''}
<form id="authf">${login ? '' : '<label>Ton pseudo dans l’équipe<input id="aname" name="name" required maxlength="40" autocomplete="nickname"></label>'}
<label>E-mail<input id="aemail" type="email" name="email" required autocomplete="email"></label>
<label>Mot de passe<input id="apass" type="password" name="password" required minlength="6" autocomplete="${login ? 'current-password' : 'new-password'}"></label>
<button class="pri">${login ? 'Se connecter' : 'Créer mon compte'}</button></form>
<button class="ghost" data-act="resetcfg">Changer de code d'invitation</button></div></section>`
}

// ---------- Vues ----------
function vHome() {
  const td = today(); const up = SP('events').filter(e => String(e.ev_date || '') >= td).sort((x, y) => String(x.ev_date + (x.ev_time || '')).localeCompare(String(y.ev_date + (y.ev_time || ''))));
  const all = SP('tasks'), mine = all.filter(t => t.assignee === me && t.status !== 'done'), cnt = k => all.filter(t => (t.status || 'todo') === k).length;
  const first = names[me] ? names[me].split(' ')[0] : ''; const none = t => `<p class="empty">${t}</p>`;
  const tot = all.length, dn = cnt('done'), pct = tot ? Math.round(dn / tot * 100) : 0;
  const d = new Date(), dstr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const tagS = t => `<span class="tag">${esc(t.tag || 'Autre')}</span>`;
  const myT = mine.slice(0, 5).map(t => `<button class="hrowb" data-act="edittask" data-id="${esc(t.id)}"><span class="hst ${t.status === 'doing' ? 'doing' : 'todo'}" aria-hidden="true"></span><span class="ht">${esc(t.title)}</span>${tagS(t)}<span class="hm">${t.status === 'doing' ? 'En cours' : 'À faire'}</span></button>`).join('') || none('Aucune tâche assignée à toi. Tranquille.');
  const segs = Array.from({ length: 10 }, (_, i) => `<span class="${i < Math.round(pct / 10) ? 'on' : ''}"></span>`).join('');
  const prog = `<div class="kbig"><b>${pct}%</b><span>${dn} / ${tot} tâches terminées</span></div><div class="ksegs" role="img" aria-label="Avancement ${pct} %">${segs}</div><div class="k3"><div><b>${cnt('todo')}</b>à faire</div><div><b>${cnt('doing')}</b>en cours</div><div><b>${dn}</b>terminées</div></div>`;
  const onl = members.filter(m => online.has(m.user_id));
  const team = `<div class="avstack">${onl.slice(0, 6).map(m => `<button class="profb" data-prof="${esc(m.user_id)}" aria-label="Profil de ${esc(m.name)}">${avatar(m.user_id)}</button>`).join('') || '<span class="sub">Personne en ligne</span>'}</div><div class="sub">${onl.slice(0, 4).map(m => `${esc(m.name.split(' ')[0])} · ${esc(STATUS[statusOf(m.user_id)].l.toLowerCase())}`).join('<br>')}</div>`;
  const nx = up[0], nd = nx ? fmtDate(nx.ev_date) : null;
  const rdv = nx ? `<a class="rdv" href="${hrefOf('planning')}"><span class="rdvd"><small>${esc(nd.w.slice(0, 3)).toUpperCase()}.</small><b>${esc(nd.d)}</b></span><span><b>${esc(nx.title)}</b><small>${esc(nd.m)}${nx.ev_time ? ' · ' + esc(nx.ev_time) : ''}${nx.place ? ' · ' + esc(nx.place) : ''}</small></span></a>` : none('Rien de prévu.');
  const ev = [];
  SP('files').slice(0, 8).forEach(f => ev.push([f.at, 'f', f.author, `a envoyé <b>${esc(f.name)}</b>`]));
  all.filter(t => t.status === 'done').slice(0, 6).forEach(t => ev.push([t.upd || t.at, 'd', t.assignee || t.author, `a terminé « ${esc(t.title)} »`]));
  all.slice(0, 6).forEach(t => ev.push([t.at, 't', t.author, `a créé la tâche « ${esc(t.title)} »`]));
  SP('notes').slice(0, 4).forEach(n => ev.push([n.upd || n.at, 'n', n.upd_by || n.author, `a modifié la note « ${esc(n.title || 'Sans titre')} »`]));
  const acts = ev.filter(x => x[0] && x[2]).sort((x, y) => ts(y[0]) - ts(x[0])).slice(0, 5).map(([at, k, who, w]) => `<div class="hact"><i class="k-${k}"></i><span><b>${esc(nm(who))}</b> ${w}</span><small>${esc(ago(at))}</small></div>`).join('') || none('Pas encore d’activité.');
  const fl = curFiles().slice(0, 4).map(({ f, n }) => `<button class="hrowb" data-act="openfile" data-id="${esc(f.id)}"><span class="fext">${esc((String(f.name).split('.').pop() || '?').slice(0, 4).toUpperCase())}</span><span class="ht">${esc(f.name)}${n > 1 ? ` <span class="ver">v${n}</span>` : ''}</span><span class="hm">${esc(nm(f.author))}</span></button>`).join('') || none('Aucun fichier partagé.');
  const T = (cls, title, link, body) => `<section class="tile ${cls}"><h3>${title}${link ? `<a href="${hrefOf(link[0])}">${link[1]} →</a>` : ''}</h3>${body}</section>`;
  return `<div class="bar"><div><h2>${first ? 'Bonjour ' + esc(first) : 'Accueil'}</h2><p class="sub">${esc(dstr.charAt(0).toUpperCase() + dstr.slice(1))} · ${esc(SPACES[space].label)} · ${mine.length ? mine.length + ' tâche' + (mine.length > 1 ? 's' : '') + ' pour toi' : 'aucune tâche pour toi'}</p></div><button class="pri" data-act="newtask">Nouvelle tâche</button></div>
<div class="bento">${T('t-mine', 'Mes tâches', ['taches', 'Toutes'], myT)}${T('t-prog', 'Avancement', null, prog)}${T('t-team', 'En ligne', ['equipe', 'Équipe'], team)}${T('t-act', 'Activité récente', null, acts)}${T('t-rdv', 'Prochain rendez-vous', ['planning', 'Planning'], rdv)}${T('t-files', 'Derniers fichiers', ['fichiers', 'Fichiers'], fl)}</div>`
}
function fileCard(f, n = 1) {
  const th = f.path && thumbs[f.path]; const img = th && /^image\//.test(String(f.type || '')); const ext = (String(f.name || '').split('.').pop() || '').slice(0, 4).toUpperCase(); const id = esc(f.id);
  return `<div class="frow" draggable="true" data-fid="${id}" title="Glisse vers un dossier à gauche pour déplacer"><div class="ico">${img ? `<img src="${esc(th.url)}" alt="">` : (f.kind === 'link' ? 'LIEN' : f.kind === 'gofile' ? 'GOFILE' : esc(ext || '—'))}</div>
<div><b title="${esc(f.name)}">${esc(f.name)}</b>${n > 1 ? `<span class="ver" title="${n} versions">v${n}</span>` : ''}<div class="c">${esc(nm(f.author))} · ${esc(ago(f.at))}</div></div>
<span class="c h1">${esc(f.folder || 'Autre')}</span><span class="c r">${f.size ? esc(size(f.size)) : ''}</span>
<div class="row end">${n > 1 ? `<button class="sm ghost" data-act="fhist" data-id="${id}">Historique</button>` : ''}<button class="sm" data-act="openfile" data-id="${id}">${f.kind === 'upload' ? 'Télécharger' : 'Ouvrir'}</button>${f.kind !== 'upload' ? `<button class="sm ghost" data-act="copy" data-id="${id}">Copier</button>` : ''}<button class="sm ghost" data-act="delfile" data-id="${id}" aria-label="Supprimer">Supprimer</button></div></div>`
}
function vFiles() {
  const q = fileQ.toLowerCase(); const cf = curFiles(); const list = cf.filter(({ f }) => (fileFolder === 'Tous' || f.folder === fileFolder) && (!q || String(f.name || '').toLowerCase().includes(q)));
  const nIn = fo => fo === 'Tous' ? cf.length : cf.filter(({ f }) => f.folder === fo).length;
  return `<div class="bar"><div><h2>Fichiers</h2><p class="sub">${esc(C().filesSub)}</p></div><div class="row"><button class="ghost" data-act="newlink">Ajouter un lien</button><label class="btn" for="goin" tabindex="0">Gros fichier (Gofile)</label><input type="file" id="goin" multiple hidden><label class="btn pri" for="upin" tabindex="0">Envoyer des fichiers</label><input type="file" id="upin" multiple hidden></div></div>
${uploading.length ? `<p class="up">Envoi en cours : ${uploading.map(u => esc(u.name) + (u.via ? ' vers ' + u.via : '') + (u.pct != null ? ` (${u.pct} %)` : '')).join(', ')}</p>` : ''}
<div class="fl2"><aside class="folders" aria-label="Dossiers">${['Tous', ...C().folders].map(f => `<button class="fold${f === fileFolder ? ' on' : ''}" data-act="folder" data-id="${esc(f)}" aria-pressed="${f === fileFolder}">${f === 'Tous' ? 'Tous les fichiers' : esc(f)}<span>${nIn(f)}</span></button>`).join('')}
<div class="fhelp"><b>Envoyer</b> : glisse tes fichiers n'importe où sur cette page.<br>Jusqu'à 50 Mo, ils restent privés dans l'équipe. Au-delà, ils passent par Gofile : toute personne qui a le lien peut télécharger, et Gofile supprime les fichiers inutilisés après quelques semaines.</div></aside>
<div class="fmain"><div class="ftool"><div class="srch"><input id="fq" type="search" placeholder="Rechercher un fichier" value="${esc(fileQ)}" aria-label="Rechercher un fichier">${fileQ ? '<button class="clr" data-act="clrq" data-id="fq" aria-label="Effacer la recherche">×</button>' : ''}</div><label class="fdest">Envoyer dans<select id="upFolder" aria-label="Dossier où envoyer">${opts(C().folders, fileFolder !== 'Tous' && C().folders.includes(fileFolder) ? fileFolder : C().folders[0])}</select></label></div>
${list.length ? `<div class="tbl">${list.map(x => fileCard(x.f, x.n)).join('')}</div>` : `<div class="emptyb"><b>${SP('files').length ? 'Aucun fichier ne correspond.' : 'Aucun fichier pour l’instant.'}</b><span>${SP('files').length ? 'Essaie un autre dossier ou une autre recherche.' : 'Glisse un fichier ici ou clique sur « Envoyer des fichiers ».'}</span></div>`}</div></div>`
}
function card(t, i) {
  const id = esc(t.id);
  const nn = tnReady ? S.task_notes.filter(n => n.task === t.id).length : 0;
  return `<article class="task${t.prio === 'Haute' ? ' hi' : ''}" draggable="true" data-task="${id}"><div class="thead"><button class="tt" data-act="edittask" data-id="${id}">${esc(t.title || 'Sans titre')}</button><button class="tdel" data-act="deltask" data-id="${id}" aria-label="Supprimer la tâche" title="Supprimer la tâche"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></div>
${t.descr ? `<p>${esc(String(t.descr).slice(0, 140))}</p>` : ''}
<div class="meta"><span class="tag">${esc(t.tag || 'Autre')}</span>${t.prio === 'Haute' ? '<span class="hot">Urgent</span>' : ''}<span>${t.assignee ? esc(nm(t.assignee)) : 'Personne'}</span>${nn ? `<button class="tnc" data-act="edittask" data-id="${id}" aria-label="${nn} note${nn > 1 ? 's' : ''}" title="${nn} note${nn > 1 ? 's' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>${nn}</button>` : ''}</div>
<div class="mv">${i > 0 ? `<button class="sm" data-act="mv" data-id="${id}" data-to="${ST[i - 1][0]}" aria-label="Revenir à ${ST[i - 1][1]}">←</button>` : ''}${i < 2 ? `<button class="sm" data-act="mv" data-id="${id}" data-to="${ST[i + 1][0]}">${i === 0 ? 'Commencer' : 'Terminer'} →</button>` : ''}</div></article>`
}
function vTasks() {
  const tl = taskMine ? SP('tasks').filter(t => t.assignee === me) : SP('tasks');
  return `<div class="bar"><div><h2>Tâches</h2><p class="sub">Glisse une tâche d'une colonne à l'autre pour changer son statut.</p></div><div class="row"><label class="chk"><input type="checkbox" data-act="tmine"${taskMine ? ' checked' : ''}> Seulement les miennes</label><button class="pri" data-act="newtask">Nouvelle tâche</button></div></div>
<div class="kanban">${ST.map(([k, l], i) => { const col = tl.filter(t => (ST.some(s => s[0] === t.status) ? t.status : 'todo') === k); return `<section class="col c-${k}" data-col="${k}"><h3><i></i>${l} <span>${col.length}</span></h3>${col.map(t => card(t, i)).join('') || '<p class="empty">Rien ici.</p>'}</section>` }).join('')}</div>`
}
function evRow(e) {
  const d = fmtDate(e.ev_date); const going = Array.isArray(e.going) ? e.going.filter(isId) : []; const mine = going.includes(me);
  return `<article class="ev"><div class="when"><b>${esc(d.d)}</b><span>${esc(d.m)}</span></div>
<div class="what"><h3>${esc(e.title || 'Sans titre')}</h3><p class="sub">${esc(d.w)}${e.ev_time ? ' · ' + esc(e.ev_time) : ''}${e.place ? ' · ' + esc(e.place) : ''}</p>${e.descr ? `<p>${esc(e.descr)}</p>` : ''}
<p class="sub">${going.length ? 'Présents : ' + going.map(g => esc(nm(g))).join(', ') : 'Personne d’inscrit pour l’instant'}</p></div>
<div class="acts"><button class="${mine ? '' : 'pri'}" data-act="go" data-id="${esc(e.id)}">${mine ? 'Je ne viens plus' : 'Je participe'}</button><button class="ghost" data-act="editev" data-id="${esc(e.id)}">Modifier</button></div></article>`
}
function vPlan() {
  const td = today(); const up = SP('events').filter(e => String(e.ev_date || '') >= td), past = SP('events').filter(e => String(e.ev_date || '') < td).reverse();
  return `<div class="bar"><div><h2>Planning</h2><p class="sub">Réunions, sessions de test et échéances.</p></div><button class="pri" data-act="newev">Nouvel événement</button></div>
${up.length ? `<div class="tbl">${up.map(evRow).join('')}</div>` : ''}<div>${up.length ? '' : '<p class="empty">Aucun rendez-vous prévu. Programme la prochaine réunion ou session de test.</p>'}</div>
${past.length ? `<details><summary>Événements passés (${past.length})</summary><div class="tbl past">${past.map(evRow).join('')}</div></details>` : ''}`
}
function editor(n) {
  return `<input id="ntitle" class="big" value="${esc(n.title || '')}" aria-label="Titre de la note" maxlength="140">
<div class="row"><select id="ntag" aria-label="Catégorie">${opts(C().ntags.includes(n.tag) || !n.tag ? C().ntags : [n.tag, ...C().ntags], n.tag)}</select><span class="sub">Modifiée ${esc(ago(n.upd))} par ${esc(nm(n.upd_by || n.author))}</span></div>
<div class="row nmode"><div class="seg" role="tablist" aria-label="Mode"><button role="tab" aria-selected="${noteMode === 'edit'}" class="${noteMode === 'edit' ? 'on' : ''}" data-act="nmode" data-id="edit">Écrire</button><button role="tab" aria-selected="${noteMode === 'view'}" class="${noteMode === 'view' ? 'on' : ''}" data-act="nmode" data-id="view">Aperçu</button></div>${noteMode === 'edit' ? '<button class="sm ghost" data-code="nbody" title="Insérer un bloc de code">&lt;/&gt; Bloc de code</button>' : ''}<span class="sub">Mets ton code entre deux lignes <code class="ic">\`\`\`lua</code> et <code class="ic">\`\`\`</code> pour le colorer.</span></div>
<textarea id="nbody" placeholder="Écris ici : ${esc(C().notesHint)}… (Ctrl+S pour enregistrer)"${noteMode === 'view' ? ' hidden' : ''}>${esc(noteLive != null ? noteLive : (n.body || ''))}</textarea>${noteMode === 'view' ? `<div class="nview">${rich(noteLive != null ? noteLive : n.body) || '<p class="empty">Note vide.</p>'}</div>` : ''}
<div class="row end"><button class="danger" data-act="delnote" data-id="${esc(n.id)}">Supprimer</button><button class="pri" data-act="savenote" data-id="${esc(n.id)}">Enregistrer</button></div>`
}
function vNotes() {
  const q = noteQ.toLowerCase(); const list = SP('notes').filter(n => !q || String(n.title || '').toLowerCase().includes(q) || String(n.body || '').toLowerCase().includes(q)); const n = SP('notes').find(x => x.id === noteSel);
  return `<div class="bar"><div><h2>Notes &amp; docs</h2><p class="sub">${esc(C().notesSub)}</p></div><button class="pri" data-act="newnote">Nouvelle note</button></div>
<div class="notes"><aside class="nl"><div class="srch"><input id="nq" type="search" placeholder="Chercher dans les notes" value="${esc(noteQ)}" aria-label="Chercher dans les notes">${noteQ ? '<button class="clr" data-act="clrq" data-id="nq" aria-label="Effacer la recherche">×</button>' : ''}</div>
<ul>${list.map(x => `<li><button data-act="selnote" data-id="${esc(x.id)}" class="${x.id === noteSel ? 'on' : ''}"><b>${esc(x.title || 'Sans titre')}</b><span>${esc(x.tag || '')} · ${esc(ago(x.upd))}</span></button></li>`).join('') || '<li class="empty">Aucune note.</li>'}</ul></aside>
<div class="editor">${n ? editor(n) : `<p class="empty">Choisis une note ou crée-en une : ${esc(C().notesHint)}…</p>`}</div></div>`
}
function vChat() {
  const ms = [...SP('messages')].reverse();
  const onl = members.filter(m => online.has(m.user_id)).length;
  const pics = SP('messages').filter(m => okImgPath(m.img)).slice(0, 6);
  const side = `<aside class="chatside"><section class="tile"><h3>Images partagées</h3>${pics.length ? `<div class="pgrid">${pics.map(m => imgs[m.img] ? `<button class="pthumb" data-img="${esc(m.img)}" aria-label="Agrandir l'image de ${esc(nm(m.author))}"><img src="${esc(imgs[m.img].u)}" alt=""></button>` : '<span class="pthumb ph"></span>').join('')}</div>` : '<p class="empty">Aucune image pour l’instant.</p>'}</section><section class="tile"><h3>Derniers fichiers<a href="${hrefOf('fichiers')}">Fichiers →</a></h3>${curFiles().slice(0, 4).map(({ f }) => `<button class="hrowb" data-act="openfile" data-id="${esc(f.id)}"><span class="fext">${esc((String(f.name).split('.').pop() || '?').slice(0, 4).toUpperCase())}</span><span class="ht">${esc(f.name)}</span></button>`).join('') || '<p class="empty">Aucun fichier.</p>'}</section></aside>`;
  return `<div class="bar"><div><h2>Discussion</h2><p class="sub">Le fil de l'équipe ${esc(SPACES[space].label)} · ${onl} en ligne</p></div></div>
<div class="chatwrap"><div class="chatcol"><div class="chat" id="chatlog">${ms.map(m => `<div class="msg${m.author === me ? ' me' : ''}"><div class="who"><button class="whob" data-prof="${esc(m.author)}">${avatar(m.author)}${esc(nm(m.author))}</button> <span>${esc(ago(m.at))}</span>${rxAdd('msg', m.id)}${m.author === me ? `<button class="x" data-act="delmsg" data-id="${esc(m.id)}" aria-label="Supprimer le message">×</button>` : ''}</div>${msgImg(m.img)}${m.body ? `<div class="txt">${rich(m.body)}</div>` : ''}${rxBar('msg', m.id)}</div>`).join('') || '<p class="empty">Lance la conversation.</p>'}</div>
${imgQueue('chat')}<form class="send" id="chatf">${imgPick('cimgin')}${codePick('ctext')}<textarea id="ctext" rows="2" maxlength="4000" placeholder="Écrire à l'équipe… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)" aria-label="Message"></textarea><button class="pri">Envoyer</button></form></div>${side}</div>`
}
function vTeam() {
  const list = [...members].sort((x, y) => (y.user_id === me) - (x.user_id === me) || (online.has(y.user_id) - online.has(x.user_id)) || String(x.name).localeCompare(String(y.name)));
  return `<div class="bar"><div><h2>Équipe</h2><p class="sub">${members.length} membre${members.length > 1 ? 's' : ''}. Clique sur quelqu'un pour voir son profil.</p></div>${profReady ? '<a class="btn" href="#parametres">Modifier mon profil</a>' : ''}</div>
${profReady ? '' : '<div class="notice" style="margin-bottom:14px">Pour les profils (photo, rôle, bio), lance le fichier <b>supabase-update-0.5.sql</b> dans Supabase &gt; SQL Editor, puis redémarre l\'appli.</div>'}
<div class="team">${list.map(m => { const id = esc(m.user_id); return `<article class="mcard"><button class="mtop" data-prof="${id}" aria-label="Voir le profil de ${esc(m.name)}">${avatar(m.user_id, 'xl')}<b>${esc(m.name)}${m.user_id === me ? ' <span class="sub">(moi)</span>' : ''}</b>${m.role ? `<span class="role">${esc(m.role)}</span>` : ''}<small>${esc(seenText(m))}</small></button>${m.bio ? `<p class="mbio">${esc(String(m.bio).slice(0, 140))}</p>` : '<p class="mbio empty2">Pas encore de bio.</p>'}<div class="row">${m.user_id !== me ? `<button class="sm pri" data-act="dmto" data-id="${id}">Message</button>` : ''}<button class="sm ghost" data-prof="${id}">Voir le profil</button></div></article>` }).join('')}</div>`
}
function vSettings() {
  return `<div class="bar"><div><h2>Paramètres</h2><p class="sub">Invitations, pseudo et réglages de l'application.</p></div><button class="ghost" data-act="logout">Se déconnecter</button></div>
<div class="grid2">
<section class="panel"><h3>Inviter un collègue</h3><p>Envoie-lui l'installateur de l'application et ce code d'invitation. Il le collera au premier lancement.</p>
<div class="code" id="invite">${esc(makeCode(cfg))}</div><div class="row" style="margin-top:10px"><button class="pri" data-act="copyinvite">Copier le code</button></div>
<p class="sub" style="margin-top:10px">Garde ce code dans l'équipe : n'importe qui qui l'a peut rejoindre DebitageHQ.</p></section>
${profileEditor()}
<section class="panel"><h3>Application</h3><p class="sub">DebitageHQ version ${esc(version)}. Fermer la fenêtre range l'appli dans la zone de notification (en bas à droite). Pour la quitter, clic droit sur son icône puis « Quitter DebitageHQ ».</p>
<label class="chk" style="margin-top:10px"><input type="checkbox" data-act="sound"${soundOn ? ' checked' : ''}> Son des notifications (messages et tâches)</label>
<label class="chk" style="margin-top:8px"><input type="checkbox" data-act="autostart"${autoStart ? ' checked' : ''}> Lancer DebitageHQ au démarrage de Windows</label>
<div class="row" style="margin-top:10px"><button data-act="checkupd">Rechercher une mise à jour</button><button class="danger" data-act="resetcfg">Quitter cette équipe sur ce PC</button></div></section>
</div>`
}

const V = { accueil: vHome, fichiers: vFiles, taches: vTasks, planning: vPlan, notes: vNotes, discussion: vChat, idees: vIdees, assistant: vAssistant, equipe: vTeam, remote: vRemote, parametres: vSettings, notifications: vNotifs };
function render(fresh) {
  const main = $('#main'); const a = document.activeElement; const keep = {};
  if (!fresh) main.querySelectorAll('[data-dirty]').forEach(el => { if (el.id) keep[el.id] = el.value });
  const fid = !fresh && a && main.contains(a) && a.id ? a.id : null; let s0 = null, s1 = null; try { s0 = a.selectionStart; s1 = a.selectionEnd } catch {}
  const ch = $('#chatlog'); const atBot = !ch || ch.scrollHeight - ch.scrollTop - ch.clientHeight < 80;
  $('#shell').classList.toggle('gate-mode', phase !== 'app');
  if (phase === 'app') { renderMe(); const T = { accueil: 'Accueil', fichiers: 'Fichiers', taches: 'Tâches', planning: 'Planning', notes: 'Notes & docs', discussion: 'Discussion', idees: 'Idées', assistant: 'Assistant', equipe: 'Équipe' }; $('#pgtitle').textContent = view === 'equipe' ? 'Équipe' : view === 'remote' ? 'Contrôle à distance' : view === 'parametres' ? 'Paramètres' : view === 'notifications' ? 'Notifications' : `${SPACES[space].label}  ·  ${T[view] || ''}` }
  main.innerHTML = phase === 'setup' ? vSetup() : phase === 'auth' ? vAuth() : phase === 'app' ? ((!spaceReady && !GLOBAL.includes(view) ? `<div class="notice" style="margin-bottom:14px">Pour séparer Serveur GTA 6 et Cheat, lance le fichier <b>supabase-update-0.2.sql</b> dans Supabase &gt; SQL Editor, puis redémarre l'appli. En attendant, tu ne peux rien ajouter.</div>` : '') + V[view]()) : '<p class="empty">Connexion…</p>';
  for (const k in keep) { const el = document.getElementById(k); if (el) { try { el.value = keep[k]; el.dataset.dirty = 1 } catch {} } }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (s0 != null) el.setSelectionRange(s0, s1) } catch {} } }
  const c = $('#chatlog'); if (c && atBot) c.scrollTop = c.scrollHeight;
  updateNotifBadge(); buildSide();
  const slot = $('#rcslot'); if (slot) { slot.appendChild(rcVideo); if (rcVideo.srcObject) rcVideo.play().catch(() => {}) }
  renderDM();
}
// ---------- Menu latéral : deux catégories repliables ----------
const ICONS = {
  accueil: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  fichiers: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
  taches: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
  planning: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  notes: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  discussion: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  notifications: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  parametres: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  remote: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 9 4 2.5-4 2.5z"/>',
  serveur: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  cheat: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9.5 12 2 2 3.5-4"/>'
};
const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const LABELS = { accueil: 'Accueil', fichiers: 'Fichiers', taches: 'Tâches', planning: 'Planning', notes: 'Notes & docs', discussion: 'Discussion' };
function toggleGrp(id, save = true) { const g = document.querySelector(`.grp[data-g="${id}"]`); if (!g) return; const closed = g.classList.toggle('closed'); g.querySelector('.gh').setAttribute('aria-expanded', String(!closed)); if (save) try { localStorage.setItem('qg.grp.' + id, closed ? '0' : '1') } catch {} }
const TABS = { accueil: 'Accueil', taches: 'Tâches', fichiers: 'Fichiers', planning: 'Planning', notes: 'Notes', discussion: 'Discussion' };
const TABS_YT = { accueil: 'Accueil', idees: 'Idées', taches: 'Tâches', fichiers: 'Fichiers', planning: 'Planning', assistant: 'Assistant', discussion: 'Discussion' };
const tabsFor = s => s === 'youtube' ? TABS_YT : TABS;
function buildSide() {
  const g = GLOBAL.includes(view), cur = g ? 'accueil' : view;
  $('#spaceseg').innerHTML = Object.entries(SPACES).map(([id, s]) => `<a role="tab" class="ss-${id}" href="#${id}-${cur}" aria-selected="${!g && space === id}">${esc(s.label)}</a>`).join('');
  $('#tabs').innerHTML = Object.entries(tabsFor(space)).map(([v, l]) => `<a href="#${space}-${v}"${!g && view === v ? ' aria-current="page"' : ''}>${l}</a>`).join('')
    + `<span class="tabsep" aria-hidden="true"></span><a href="#remote" class="tabg" aria-label="Contrôle à distance" title="Contrôle à distance"${view === 'remote' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg><span class="tl">Contrôle à distance</span></a>`;
  const b = $('#nbell'); if (b) { b.hidden = phase !== 'app'; b.classList.toggle('on', view === 'notifications') }
}

// ---------- Messages privés (panneau de droite) ----------
const unreadFrom = id => S.dms.filter(d => d.recipient === me && d.sender === id && !d.read_at).length;
const unreadAll = () => S.dms.filter(d => d.recipient === me && !d.read_at).length;
const seenText = m => online.has(m.user_id) ? STATUS[statusOf(m.user_id)].l : (m.last_seen ? 'Vu ' + ago(m.last_seen) : 'Hors ligne');
const avatar = (id, big) => `<span class="av${big === 'xl' ? ' xl' : big ? ' big' : ''}${online.has(id) ? ' on st-' + statusOf(id) : ''}">${avInner(id)}</span>`;
function markRead() {
  if (!dmOpen || !dmWith || !document.hasFocus()) return;
  const ids = S.dms.filter(d => d.recipient === me && d.sender === dmWith && !d.read_at).map(d => d.id);
  if (!ids.length) return;
  const now = new Date().toISOString(); S.dms.forEach(d => { if (ids.includes(d.id)) d.read_at = now });
  sb.from('dms').update({ read_at: now }).in('id', ids).then(() => {}, () => {});
}
function renderDM() {
  const box = $('#dm'), shell = $('#shell'), tg = $('#dmtoggle');
  if (!box) return;
  const show = phase === 'app' && dmOpen;
  shell.classList.toggle('dm-open', show);
  if (tg) { const n = phase === 'app' ? unreadAll() : 0; tg.hidden = phase !== 'app'; tg.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>${n ? `<b class="badge">${n}</b>` : ''}`; tg.setAttribute('aria-label', n ? `Messages privés, ${n} non lu${n > 1 ? 's' : ''}` : 'Messages privés'); tg.classList.toggle('on', show) }
  if (!show) { box.innerHTML = ''; return }
  const hadFocus = document.activeElement && document.activeElement.id === 'dmtext';
  const list = $('#dmlog'); const atBot = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  if (!dmReady) {
    box.innerHTML = `<div class="dmhead"><b>Messages</b><button class="x" data-dm="close" aria-label="Fermer le panneau">×</button></div><div class="dmempty">Les messages privés ont besoin d'une petite mise à jour du serveur : lance le fichier <b>supabase-update-0.2.sql</b> dans Supabase &gt; SQL Editor, puis redémarre l'appli.</div>`;
    return;
  }
  if (!dmWith) {
    const others = members.filter(m => m.user_id !== me).sort((x, y) => (online.has(y.user_id) - online.has(x.user_id)) || String(x.name).localeCompare(String(y.name)));
    const nOn = others.filter(m => online.has(m.user_id)).length;
    box.innerHTML = `<div class="dmhead"><b>Messages</b><span class="sub">${nOn} en ligne</span><button class="x" data-dm="close" aria-label="Fermer le panneau">×</button></div>
<div class="dmlist">${others.map(m => { const last = S.dms.filter(d => (d.sender === m.user_id && d.recipient === me) || (d.sender === me && d.recipient === m.user_id)).sort((x, y) => ts(y.at) - ts(x.at))[0]; const u = unreadFrom(m.user_id);
  return `<button class="dmrow" data-dm="open" data-id="${esc(m.user_id)}">${avatar(m.user_id)}<span class="dmmid"><b>${esc(m.name)}</b><small>${last ? esc((last.sender === me ? 'Toi : ' : '') + bodyOf(last).slice(0, 40)) : esc(seenText(m))}</small></span>${u ? `<b class="badge">${u}</b>` : ''}</button>` }).join('') || '<p class="dmempty">Invite des membres pour discuter en privé.</p>'}</div>`;
    return;
  }
  const m = members.find(x => x.user_id === dmWith) || { user_id: dmWith, name: nm(dmWith) };
  const conv = S.dms.filter(d => (d.sender === dmWith && d.recipient === me) || (d.sender === me && d.recipient === dmWith)).slice().sort((x, y) => ts(x.at) - ts(y.at));
  box.innerHTML = `<div class="dmhead"><button class="x" data-dm="back" aria-label="Retour">‹</button><button class="profb" data-prof="${esc(dmWith)}" aria-label="Voir le profil de ${esc(m.name)}">${avatar(dmWith, true)}</button><span class="dmmid"><b>${esc(m.name)}</b><small>${esc(seenText(m))}</small></span><button class="x" data-dm="close" aria-label="Fermer le panneau">×</button></div>
<div class="dmlog" id="dmlog">${conv.map(d => `<div class="dmmsg${d.sender === me ? ' me' : ''}"><div class="dmb">${msgImg(d.img)}${d.body ? `<div class="dmtxt">${rich(d.body)}</div>` : ''}${rxAdd('dm', d.id)}</div>${rxBar('dm', d.id)}<small>${esc(ago(d.at))}${d.sender === me && d.read_at ? ' · lu' : ''}</small></div>`).join('') || `<p class="dmempty">Commence la discussion avec ${esc(m.name)}.</p>`}</div>
${imgQueue('dm')}<form class="dmsend" id="dmf">${imgPick('dmimgin')}${codePick('dmtext')}<textarea id="dmtext" rows="2" maxlength="4000" placeholder="Message à ${esc(m.name)}…" aria-label="Message privé"></textarea><button class="pri" aria-label="Envoyer">Envoyer</button></form>`;
  const ta = $('#dmtext'); ta.value = dmDraft; if (hadFocus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
  const lg = $('#dmlog'); if (lg && atBot) lg.scrollTop = lg.scrollHeight;
}
function setDmOpen(v) { dmOpen = v; try { localStorage.setItem('qg.dm', v ? '1' : '0') } catch {} renderDM() }
function openDm(id) { dmWith = id; dmDraft = ''; setDmOpen(true); markRead(); renderDM(); const t = $('#dmtext'); if (t) t.focus() }
$('#dm').addEventListener('click', e => { const b = e.target.closest('[data-dm]'); if (!b) return; e.preventDefault(); const a = b.dataset.dm;
  if (a === 'close') setDmOpen(false); else if (a === 'back') { dmWith = null; renderDM() } else if (a === 'open') openDm(b.dataset.id) });
$('#dm').addEventListener('input', e => { if (e.target.id === 'dmtext') dmDraft = e.target.value });
$('#dm').addEventListener('keydown', e => { if (e.target.id === 'dmtext' && e.key === 'Enter' && !e.shiftKey && (e.ctrlKey || !inFence(e.target))) { e.preventDefault(); e.target.form.requestSubmit() } });
$('#dm').addEventListener('submit', async e => {
  e.preventDefault(); const text = dmDraft.trim(); const imgs = pend.dm.splice(0); if ((!text && !imgs.length) || !dmWith) return;
  const to = dmWith; dmDraft = ''; const t = $('#dmtext'); if (t) t.value = ''; if (imgs.length) renderDM();
  const ok = await sendWithImages(text, imgs, async (body, img) => {
    const row = { sender: me, recipient: to, body: body.slice(0, 4000) }; if (img) row.img = img;
    const { data, error } = await sb.from('dms').insert(row).select().single();
    if (error) { toast(sqlHint(error)); return false }
    if (data && !S.dms.some(d => d.id === data.id)) S.dms.unshift(data); ensureImgs(); renderDM(); return true });
  if (!ok && text) { dmDraft = text; renderDM() }
});
$('#dmtoggle').addEventListener('click', () => setDmOpen(!dmOpen));
window.addEventListener('focus', () => { markRead(); renderDM() });
setInterval(() => { if (phase === 'app') renderDM() }, 60000);

function route() {
  const h = location.hash.slice(1); const m = /^(serveur|cheat|youtube)-([a-z]+)$/.exec(h);
  if (m && VIEWS.includes(m[2]) && !GLOBAL.includes(m[2])) { space = m[1]; view = m[2] } else if (GLOBAL.includes(h)) view = h; else view = 'accueil';
  if (fileFolder !== 'Tous' && !C().folders.includes(fileFolder)) fileFolder = 'Tous';
  { const sh = $('#shell'); sh.classList.remove('sp-cheat', 'sp-youtube'); if (!GLOBAL.includes(view) && space !== 'serveur') sh.classList.add('sp-' + space) }
  buildSide();
  const g = document.querySelector(`.grp[data-g="${space}"]`); if (g && !GLOBAL.includes(view) && g.classList.contains('closed')) toggleGrp(space, false);
  if (view === 'fichiers') refreshThumbs();
  render(true);
}

// ---------- Fenêtres de dialogue ----------
let mSubmit = null;
function openModal(title, html, onSubmit, ok, onDel) {
  $('#modal').classList.remove('drawer');
  $('#mcancel').style.display = ''; $('#mcancel').textContent = 'Annuler'; $('#mcancel').onclick = closeModal; $('#mtitle').textContent = title; $('#mbody').innerHTML = html; $('#mok').textContent = ok || 'Enregistrer';
  $('#mok').className = ok === 'Supprimer' ? 'danger' : 'pri'; $('#mdel').innerHTML = onDel ? '<button type="button" class="danger" id="mdelb">Supprimer</button>' : '';
  if (onDel) $('#mdelb').onclick = () => { closeModal(); onDel() };
  mSubmit = onSubmit; $('#modal').hidden = false; const f = $('#mbody').querySelector('input,textarea,select'); (f || $('#mok')).focus();
}
function closeModal() { $('#modal').hidden = true; mSubmit = null }
$('#mform').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  for (const el of f.querySelectorAll('[required]')) if (!el.value.trim()) { el.focus(); toast('Remplis les champs obligatoires.'); return }
  if (!mSubmit) return; $('#mok').disabled = true; const ok = await mSubmit(Object.fromEntries(new FormData(f))); $('#mok').disabled = false; if (ok !== false) closeModal();
});
$('#mcancel').onclick = closeModal; $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal() });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal() });
function confirmDel(label, fn) { openModal('Supprimer ?', `<p>Supprimer ${esc(label)} ? C'est définitif pour toute l'équipe.</p>`, fn, 'Supprimer') }
function memberOpts(sel) { return `<option value="">Personne</option>` + members.map(m => `<option value="${esc(m.user_id)}"${m.user_id === sel ? ' selected' : ''}>${esc(m.name)}${m.user_id === me ? ' (moi)' : ''}</option>`).join('') }

function taskForm(t) {
  openModal(t ? 'Modifier la tâche' : 'Nouvelle tâche', `
<label>Titre *<input name="title" required maxlength="140" value="${esc(t ? t.title : '')}" placeholder="${esc(C().taskEx)}"></label>
<label>Détails<textarea name="descr" rows="4" maxlength="4000">${esc(t ? t.descr : '')}</textarea></label>
<div class="two"><label>Catégorie<select name="tag">${opts(t && t.tag && !C().ttags.includes(t.tag) ? [t.tag, ...C().ttags] : C().ttags, t ? t.tag : C().ttags[0])}</select></label><label>Priorité<select name="prio">${opts(['Basse', 'Normale', 'Haute'], t && t.prio || 'Normale')}</select></label></div>
<div class="two"><label>Assignée à<select name="assignee">${memberOpts(t ? t.assignee : me)}</select></label><label>Statut<select name="status">${ST.map(([k, l]) => `<option value="${k}"${(t && t.status || 'todo') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>${t ? tnBlock(t) : ''}`,
    v => { const body = { title: v.title.trim().slice(0, 140), descr: v.descr || '', tag: v.tag, prio: v.prio, assignee: v.assignee || null, status: v.status, upd: new Date().toISOString() };
      if (t) return W('tasks', sb.from('tasks').update(body).eq('id', t.id)).then(ok => { if (ok) notifyAssign({ ...t, ...body }, t.assignee); return ok });
      return (async () => { const { data, error } = await sb.from('tasks').insert({ ...body, space }).select().single(); if (error) { toast(errMsg(error)); return false } reload('tasks'); notifyAssign(data, null); return true })() }, 'Enregistrer',
    t ? () => confirmDel('cette tâche', () => W('tasks', sb.from('tasks').delete().eq('id', t.id))) : null);
  $('#modal').classList.add('drawer');
}
function evForm(e) {
  openModal(e ? 'Modifier l’événement' : 'Nouvel événement', `
<label>Titre *<input name="title" required maxlength="140" value="${esc(e ? e.title : '')}" placeholder="Ex. Réunion lore, test de l'économie"></label>
<div class="two"><label>Date *<input type="date" name="ev_date" required value="${esc(e ? e.ev_date : today())}"></label><label>Heure<input type="time" name="ev_time" value="${esc(e ? e.ev_time : '21:00')}"></label></div>
<label>Où<input name="place" maxlength="120" value="${esc(e ? e.place : '')}" placeholder="Discord vocal, en jeu…"></label>
<label>Détails<textarea name="descr" rows="4" maxlength="4000">${esc(e ? e.descr : '')}</textarea></label>`,
    v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v.ev_date)) { toast('Date invalide.'); return false } const body = { title: v.title.trim().slice(0, 140), ev_date: v.ev_date, ev_time: v.ev_time || '', place: v.place || '', descr: v.descr || '' };
      return e ? W('events', sb.from('events').update(body).eq('id', e.id)) : W('events', sb.from('events').insert({ ...body, going: [me], space })) }, 'Enregistrer',
    e ? () => confirmDel('cet événement', () => W('events', sb.from('events').delete().eq('id', e.id))) : null);
}
function linkForm() {
  openModal('Ajouter un lien', `
<label>Nom *<input name="name" required maxlength="200" placeholder="Ex. Pack de véhicules v2"></label>
<label>Adresse (https://…) *<input type="url" name="url" required placeholder="https://drive.google.com/…"></label>
<label>Dossier<select name="folder">${opts(C().folders, 'Autre')}</select></label>`,
    v => { const u = v.url.trim(); if (!u.startsWith('https://')) { toast('Le lien doit commencer par https://'); return false }
      return W('files', sb.from('files').insert({ name: v.name.trim().slice(0, 200), kind: 'link', url: u.slice(0, 2000), folder: v.folder, space })) }, 'Ajouter');
}

// ---------- Fichiers ----------
async function uploadFiles(list) {
  const folder = ($('#upFolder') || {}).value || 'Autre';
  for (const f of list) {
    if (f.size > MAX) { await goUpload(f, folder); continue }
    const u = { name: f.name, pct: null }; uploading.push(u); render(); const nPrev = verCount(f.name, space);
    const safe = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-120) || 'fichier';
    const path = `${crypto.randomUUID()}/${safe}`;
    const { error } = await sb.storage.from('files').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (error) toast(`Impossible d'envoyer ${f.name} : ${errMsg(error)}`);
    else if (!await W('files', sb.from('files').insert({ name: f.name.slice(0, 200), kind: 'upload', path, size: f.size, type: f.type || '', folder, space }))) await sb.storage.from('files').remove([path]);
    else if (nPrev) toast(`Nouvelle version de « ${f.name} » (v${nPrev + 1}). L'ancienne reste dans l'historique.`);
    uploading = uploading.filter(x => x !== u); render();
  }
}
// ---------- Gros fichiers via Gofile ----------
const okGo = u => typeof u === 'string' && /^https:\/\/gofile\.io\/d\/[A-Za-z0-9]+$/.test(u);
async function goUpload(f, folder) {
  const sp = space;
  if (!window.qg || !window.qg.gofileUpload) return toast("L'envoi Gofile n'est disponible que dans l'application installée.");
  const u = { name: f.name, pct: 0, via: 'Gofile' }; uploading.push(u); render();
  const off = QG.onGofileProgress(p => { if (p && p.name === f.name) { u.pct = p.pct; render() } });
  try {
    const r = await QG.gofileUpload(f);
    if (!r || !r.ok || !okGo(r.url)) throw new Error((r && r.error) || 'réponse inattendue de Gofile');
    const nPrev = verCount(f.name, sp);
    if (await W('files', sb.from('files').insert({ name: f.name.slice(0, 200), kind: 'gofile', url: r.url, size: f.size, type: f.type || '', folder, space: sp }))) toast(nPrev ? `Nouvelle version de « ${f.name} » sur Gofile (v${nPrev + 1}). L'ancienne reste dans l'historique.` : `${f.name} envoyé sur Gofile`);
  } catch (e) { toast(`Impossible d'envoyer ${f.name} sur Gofile : ${e.message}`) }
  finally { if (off) off(); uploading = uploading.filter(x => x !== u); render() }
}

async function openFile(f) {
  if (f.kind === 'link') { const u = fileUrl(f); if (u) QG.openExternal(u); return }
  if (f.kind === 'gofile') { if (okGo(f.url)) QG.openExternal(f.url); return }
  const { data, error } = await sb.storage.from('files').createSignedUrl(f.path, 600, { download: String(f.name || 'fichier') });
  if (error || !data) return toast(errMsg(error)); QG.openExternal(data.signedUrl); toast('Téléchargement lancé dans ton navigateur');
}

// ---------- Actions ----------
async function act(a, id, el) {
  const find = (t) => S[t].find(x => x.id === id);
  switch (a) {
    case 'atab': authTab = id; authMsg = ''; return render(true);
    case 'resetcfg': return openModal('Changer de code ?', "<p>Tu vas être déconnecté de cette équipe sur ce PC. Les données de l'équipe ne sont pas supprimées.</p>", async () => { try { await sb?.auth.signOut() } catch {} saveCfg(null); location.hash = ''; location.reload() }, 'Continuer');
    case 'logout': await sb.auth.signOut(); phase = 'auth'; return render(true);
    case 'clrq': if (id === 'fq') fileQ = ''; else noteQ = ''; render(true); { const i = $('#' + id); if (i) i.focus() } return;
    case 'folder': fileFolder = id; return render();
    case 'tmine': taskMine = el.checked; return render();
    case 'selnote': { noteSel = id; noteLive = null; const n = S.notes.find(x => x.id === id); noteMode = n && /```/.test(n.body || '') ? 'view' : 'edit'; return render(true) }
    case 'edittask': return taskForm(find('tasks'));
    case 'deltask': { const tk = find('tasks'); if (!tk) return; return confirmDel(`la tâche « ${tk.title || 'Sans titre'} »`, () => W('tasks', sb.from('tasks').delete().eq('id', id))) }
    case 'newtask': return taskForm(null);
    case 'newidea': return ideaForm(null);
    case 'editidea': return ideaForm(S.ideas.find(x => x.id === id));
    case 'delidea': { const it = S.ideas.find(x => x.id === id); if (!it) return; return confirmDel(`l'idée « ${it.title || 'Sans titre'} »`, () => W('ideas', sb.from('ideas').delete().eq('id', id))) }
    case 'aiclear': return aiClear();
    case 'aisave': return aiSaveIdea(id);
    case 'mv': return W('tasks', sb.from('tasks').update({ status: el.dataset.to, upd: new Date().toISOString() }).eq('id', id));
    case 'newev': return evForm(null);
    case 'editev': return evForm(find('events'));
    case 'go': { const e = find('events'); if (!e) return; const g = Array.isArray(e.going) ? e.going.filter(isId) : []; return W('events', sb.from('events').update({ going: g.includes(me) ? g.filter(x => x !== me) : [...g, me] }).eq('id', id)) }
    case 'newnote': { const { data, error } = await sb.from('notes').insert({ title: 'Sans titre', tag: C().ntags[0], body: '', space }).select().single(); if (error) return toast(errMsg(error)); S.notes.unshift(data); noteSel = data.id; noteQ = ''; noteLive = null; noteMode = 'edit'; render(true); const t = $('#ntitle'); if (t) { t.select(); t.focus() } return }
    case 'savenote': return saveNote(id);
    case 'delnote': return confirmDel('cette note', async () => { const ok = await W('notes', sb.from('notes').delete().eq('id', id)); if (ok) { noteSel = null; render(true) } return ok });
    case 'newlink': return linkForm();
    case 'openfile': { const f = find('files'); if (f) openFile(f); return }
    case 'copy': { const f = find('files'); const u = f && fileUrl(f); if (!u) return; try { await navigator.clipboard.writeText(u); toast('Lien copié') } catch { toast('Copie impossible') } return }
    case 'delfile': { const f = find('files'); if (!f) return; return confirmDel(`« ${f.name} »`, async () => { if (f.path && f.kind === 'upload') await sb.storage.from('files').remove([f.path]); return W('files', sb.from('files').delete().eq('id', id)) }) }
    case 'fhist': return fileHistory(id);
    case 'avdel': return avatarDelete();
    case 'nmode': { const b = $('#nbody'); if (b) noteLive = b.value; noteMode = id; return render() }
    case 'delmsg': { const m = find('messages'); const ok = await W('messages', sb.from('messages').delete().eq('id', id)); if (ok && m && m.img) sb.storage.from('files').remove([m.img]).then(() => {}, () => {}); return ok }
    case 'unimg': pend.chat.splice(+id, 1); return render();
    case 'checkupd': if (updVersion) return QG.installUpdate(); { const ok = await QG.checkUpdates(); return toast(ok ? 'Recherche en cours. Si une nouvelle version existe, elle se télécharge en arrière-plan.' : 'Les mises à jour ne sont pas disponibles dans cette version de test.') }
    case 'dmto': return openDm(id);
    case 'nreadall': return markAllNotifs();
    case 'nopen': { const n = S.notifications.find(x => x.id === id); if (!n) return; if (!n.read_at) { n.read_at = new Date().toISOString(); sb.from('notifications').update({ read_at: n.read_at }).eq('id', id).then(() => {}, () => {}) } location.hash = `${spOf(n)}-taches`; const tk = S.tasks.find(x => x.id === n.ref); if (tk) setTimeout(() => taskForm(tk), 150); else toast('Cette tâche a été supprimée.'); return }
    case 'sound': soundOn = el.checked; try { localStorage.setItem('qg.sound', soundOn ? '1' : '0') } catch {} if (soundOn) ping('msg'); return;
    case 'rcview': return rcRequest(id, false);
    case 'rcctl': return rcRequest(id, true);
    case 'rcstop': return rcEnd(true);
    case 'rctoggle': if (rc && rc.role === 'viewer' && rc.allowControl) { rc.control = !rc.control; if (!rc.control) rcSendCtl({ t: 'rel' }); render(); if (rc.control) rcVideo.focus() } return;
    case 'rcfull': { const s = $('#rcslot'); if (s && s.requestFullscreen) s.requestFullscreen().then(() => rcVideo.focus()).catch(() => {}) } return;
    case 'autostart': autoStart = el.checked; QG.setAutoStart(autoStart).then(v => { autoStart = !!v; render() }).catch(() => toast('Réglage impossible ici')); return;
    case 'copyinvite': try { await navigator.clipboard.writeText(makeCode(cfg)); toast('Code copié : envoie-le à ton collègue') } catch { toast('Copie impossible, sélectionne le code à la main') } return;
  }
}
async function saveNote(id) {
  if (!S.notes.find(x => x.id === id)) return;
  const body = { title: ($('#ntitle').value.trim() || 'Sans titre').slice(0, 140), tag: $('#ntag').value, body: $('#nbody').value, upd: new Date().toISOString(), upd_by: me };
  if (await W('notes', sb.from('notes').update(body).eq('id', id))) { const n = S.notes.find(x => x.id === id); if (n) Object.assign(n, body); noteLive = null; toast('Note enregistrée'); render(true) }
}

// ---------- Formulaires de la page ----------
async function onForm(e) {
  const f = e.target; const v = Object.fromEntries(new FormData(f)); e.preventDefault();
  const btn = f.querySelector('button.pri'); if (btn) btn.disabled = true;
  try {
    if (f.id === 'joinf') { const c = parseCode(v.code); if (!c) return toast("Ce code d'invitation n'est pas valide. Vérifie que tu l'as copié en entier."); saveCfg(c); return boot() }
    if (f.id === 'adminf') { const c = { u: String(v.u).trim().replace(/\/$/, ''), k: String(v.k).trim(), s: String(v.s).trim() }; if (!okCfg(c)) return toast("Vérifie l'URL (https://xxxx.supabase.co), la clé et le code secret."); saveCfg(c); return boot() }
    if (f.id === 'authf') {
      authMsg = '';
      if (authTab === 'login') { const { data, error } = await sb.auth.signInWithPassword({ email: v.email.trim(), password: v.password }); if (error) { authMsg = errMsg(error); return render(true) } return enter(data.user) }
      const { data, error } = await sb.auth.signUp({ email: v.email.trim(), password: v.password, options: { data: { name: v.name.trim().slice(0, 40) } } });
      if (error) { authMsg = errMsg(error); return render(true) }
      if (data.session) return enter(data.user);
      authTab = 'login'; authMsg = "Compte créé ! Clique sur le lien de confirmation reçu par e-mail, puis connecte-toi ici."; return render(true);
    }
    if (f.id === 'chatf') {
      const ta = $('#ctext'); const text = ta.value.trim(); const imgs = pend.chat.splice(0); if (!text && !imgs.length) return; ta.value = ''; delete ta.dataset.dirty; if (imgs.length) render();
      const sp = space;
      const ok = await sendWithImages(text, imgs, async (body, img) => { const row = { body: body.slice(0, 4000), space: sp }; if (img) row.img = img; const { error } = await sb.from('messages').insert(row); if (error) { toast(sqlHint(error)); return false } reload('messages'); return true });
      if (!ok && text) { const t2 = $('#ctext'); if (t2) { t2.value = text; t2.dataset.dirty = 1 } } return;
    }
    if (f.id === 'namef') { const n = String(v.name).trim().slice(0, 40); if (!n) return; const body = { name: n }; if (profReady) { body.role = String(v.role || '').trim().slice(0, 40); body.bio = String(v.bio || '').trim().slice(0, 300) } if (await W('members', sb.from('members').update(body).eq('user_id', me))) { names[me] = n; f.querySelectorAll('[data-dirty]').forEach(x => delete x.dataset.dirty); toast(profReady ? 'Profil enregistré' : 'Pseudo mis à jour'); loadMembers() } }
  } finally { if (btn) btn.disabled = false }
}

const main = $('#main');
main.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.tagName !== 'INPUT') e.preventDefault(); act(b.dataset.act, b.dataset.id, b) });
main.addEventListener('submit', e => { if (e.target.id === 'aif') { e.preventDefault(); const t = $('#aitext'); aiSend(t ? t.value : ''); return } });
main.addEventListener('submit', onForm);
main.addEventListener('click', e => { const c = e.target.closest && e.target.closest('[data-aitip]'); if (c) { e.preventDefault(); const t = $('#aitext'); if (t) { t.value = c.dataset.aitip; t.focus() } } });
main.addEventListener('input', e => { const t = e.target; if (t.id && t.type !== 'file' && t.type !== 'password') t.dataset.dirty = 1; if (t.id === 'fq') { fileQ = t.value; render() } if (t.id === 'nq') { noteQ = t.value; render() } });
main.addEventListener('change', e => { const t = e.target; if (t.id === 'upin' && t.files.length) { const l = [...t.files]; t.value = ''; uploadFiles(l) }

  if (t.id === 'goin' && t.files.length) { const l = [...t.files]; t.value = ''; const folder = ($('#upFolder') || {}).value || 'Autre'; (async () => { for (const f of l) await goUpload(f, folder) })() } if (t.id === 'ntag' || t.id === 'upFolder') t.dataset.dirty = 1 });
main.addEventListener('keydown', e => {
  const t = e.target;
  if (t.id === 'ctext' && e.key === 'Enter' && !e.shiftKey && (e.ctrlKey || !inFence(t))) { e.preventDefault(); t.form.requestSubmit() }
  if (t.id === 'aitext' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend(t.value) }
  if ((t.id === 'nbody' || t.id === 'ntitle') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); const b = main.querySelector('[data-act=savenote]'); if (b) saveNote(b.dataset.id) }
  if (t.tagName === 'LABEL' && (t.htmlFor === 'upin' || t.htmlFor === 'goin') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#' + t.htmlFor).click() }
});
main.addEventListener('dragover', e => { if (dragFile || dragTask) return; if (phase !== 'app' || (view !== 'fichiers' && view !== 'discussion')) return; e.preventDefault(); main.classList.add('drop') });
main.addEventListener('dragleave', e => { if (e.target === main) main.classList.remove('drop') });
main.addEventListener('drop', e => { if (dragFile || dragTask) return; if (phase !== 'app' || (view !== 'fichiers' && view !== 'discussion')) return; e.preventDefault(); main.classList.remove('drop'); const l = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (!l.length) return; if (view === 'discussion') addImgs('chat', l); else uploadFiles(l) });
main.addEventListener('paste', e => { if (e.target.id !== 'ctext') return; const l = [...(e.clipboardData && e.clipboardData.files || [])].filter(isImg); if (l.length) { e.preventDefault(); addImgs('chat', l) } });
document.addEventListener('dragover', e => e.preventDefault()); document.addEventListener('drop', e => e.preventDefault());
window.addEventListener('hashchange', () => { if (phase === 'app') route() });
QG.onNav(v => { if (typeof v !== 'string') return; if (v.startsWith('dm:')) return openDm(v.slice(3)); if (/^(serveur|cheat)-[a-z]+$/.test(v)) { location.hash = v; return } if (VIEWS.includes(v)) location.hash = hrefOf(v) });
setInterval(() => { if (phase === 'app' && $('#modal').hidden) render() }, 60000);

// Mises à jour
let updVersion = null;
function showUpdate(v) {
  updVersion = v; const box = $('#updbox'); if (!box) return;
  box.innerHTML = v ? `<div class="upd"><span><b>Mise à jour ${esc(v)}</b> prête à installer.</span><button class="pri" id="updbtn">Redémarrer</button></div>` : '';
  const b = $('#updbtn'); if (b) b.onclick = () => QG.installUpdate();
  if (v) updPopup(v);
}
// Fenêtre qui prévient qu'une nouvelle version est sortie (une seule fois par version)
let updShown = null;
function updPopup(v) {
  if (updShown === v) return;
  if (phase !== 'app' || !$('#modal').hidden) return setTimeout(() => updPopup(v), 5000);
  updShown = v; ping('task');
  openModal('Nouvelle mise à jour 🎉', `<p>La version <b>${esc(v)}</b> de DebitageHQ vient de sortir. Elle est déjà téléchargée.</p><p class="sub">Redémarre maintenant pour l'avoir tout de suite. Sinon, elle s'installera toute seule la prochaine fois que tu quitteras l'appli.</p>`, () => { QG.installUpdate(); return true }, 'Redémarrer maintenant');
  const c = $('#mcancel'); c.textContent = 'Plus tard'; c.onclick = () => { c.textContent = 'Annuler'; c.onclick = closeModal; closeModal() };
}
QG.onUpdate(showUpdate);
QG.updateStatus().then(v => { if (v) showUpdate(v) }).catch(() => {});

// ---------- Son et notifications ----------
let actx = null;
function ping(kind) {
  if (!soundOn || myStatus === 'dnd') return;
  try {
    actx = actx || new AudioContext();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime, notes = kind === 'task' ? [[660, 0], [880, 0.1], [1175, 0.2]] : [[880, 0], [1320, 0.09]];
    for (const [f, d] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.16, t + d + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.38);
      o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + 0.42);
    }
  } catch {}
}
const myNotifs = () => S.notifications.filter(n => n.recipient === me);
const unreadNotifs = () => myNotifs().filter(n => !n.read_at).length;
function updateNotifBadge() { const b = $('#nbadge'); if (!b) return; const n = phase === 'app' ? unreadNotifs() : 0; b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n) }
async function notifyAssign(task, prevAssignee) {
  // prévient la personne qui reçoit une tâche (sauf si c'est soi-même)
  if (!task || !task.assignee || task.assignee === me || task.assignee === prevAssignee || !notifReady) return;
  const { error } = await sb.from('notifications').insert({ recipient: task.assignee, actor: me, kind: 'task', space: spOf(task), ref: task.id || null, title: String(task.title || '').slice(0, 200) });
  if (error && /relation|does not exist|schema cache/i.test(error.message || '')) notifReady = false;
}
function markAllNotifs() {
  const ids = myNotifs().filter(n => !n.read_at).map(n => n.id); if (!ids.length) return;
  const now = new Date().toISOString(); S.notifications.forEach(n => { if (ids.includes(n.id)) n.read_at = now });
  sb.from('notifications').update({ read_at: now }).in('id', ids).then(() => {}, () => {}); render();
}
function vNotifs() {
  const list = myNotifs();
  const head = `<div class="bar"><div><h2>Notifications</h2><p class="sub">Les tâches qu'on t'assigne.</p></div>${list.some(n => !n.read_at) ? '<button data-act="nreadall">Tout marquer comme lu</button>' : ''}</div>`;
  if (!notifReady) return head + `<div class="notice">Les notifications ont besoin d'une petite mise à jour du serveur : lance le fichier <b>supabase-update-0.3.sql</b> dans Supabase &gt; SQL Editor, puis redémarre l'appli.</div>`;
  if (!list.length) return head + '<p class="empty">Aucune notification pour l’instant. Quand quelqu’un t’assigne une tâche, elle apparaît ici.</p>';
  return head + `<div class="tbl">${list.map(n => { const sp = spOf(n), t = S.tasks.find(x => x.id === n.ref);
    return `<button class="nrow${n.read_at ? '' : ' unread'}" data-act="nopen" data-id="${esc(n.id)}">${avatar(n.actor)}<span class="dmmid"><b>${esc(nm(n.actor))} t'a assigné « ${esc(n.title || (t && t.title) || 'une tâche')} »</b><small>${esc(SPACES[sp] ? SPACES[sp].label : '')} · ${esc(ago(n.at))}${t ? ' · ' + esc((ST.find(s => s[0] === t.status) || ST[0])[1]) : ''}</small></span>${n.read_at ? '' : '<i class="ndot"></i>'}</button>` }).join('')}</div>`;
}

// ---------- Contrôle à distance ----------
// La mise en relation passe par Supabase ; l'image et les commandes passent directement d'un PC à l'autre (WebRTC).
const RC_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
let rc = null, rcIncoming = null, rcMine = null; const rcChans = {};
const rcVideo = document.createElement('video');
rcVideo.autoplay = true; rcVideo.muted = true; rcVideo.playsInline = true; rcVideo.tabIndex = 0; rcVideo.id = 'rcvideo';
rcVideo.setAttribute('aria-label', 'Écran à distance');
function rcListen() {
  if (rcMine) sb.removeChannel(rcMine);
  rcMine = sb.channel('rc-' + me, { config: { broadcast: { self: false } } });
  rcMine.on('broadcast', { event: 'rc' }, ({ payload }) => rcOnSignal(payload)).subscribe();
}
function rcChan(id) {
  if (!rcChans[id]) rcChans[id] = new Promise((res, rej) => {
    const ch = sb.channel('rc-' + id, { config: { broadcast: { self: false } } });
    const t = setTimeout(() => { delete rcChans[id]; rej(new Error('connexion impossible au serveur')) }, 10000);
    ch.subscribe(s => { if (s === 'SUBSCRIBED') { clearTimeout(t); res(ch) } });
  });
  return rcChans[id];
}
async function rcSend(to, p) { const ch = await rcChan(to); return ch.send({ type: 'broadcast', event: 'rc', payload: { ...p, from: me } }) }
const sdpOf = d => ({ type: d.type, sdp: d.sdp });
function rcPeer() {
  const pc = new RTCPeerConnection({ iceServers: RC_ICE });
  pc.onicecandidate = e => { if (e.candidate && rc && rc.pc === pc) rcSend(rc.peer, { k: 'ice', sid: rc.sid, c: e.candidate.toJSON() }).catch(() => {}) };
  pc.onconnectionstatechange = () => {
    if (!rc || rc.pc !== pc) return;
    const s = pc.connectionState;
    if (s === 'connected') { rc.state = 'live'; clearTimeout(rc.timer); render() }
    else if (s === 'failed') { toast("La connexion directe a échoué : un des réseaux bloque peut-être ce type de connexion."); rcEnd(true) }
    else if (s === 'disconnected') { clearTimeout(rc.timer); rc.timer = setTimeout(() => { if (rc && rc.pc === pc && pc.connectionState !== 'connected') { toast('Connexion perdue.'); rcEnd(true) } }, 8000) }
  };
  return pc;
}
async function rcFlush() { if (!rc || !rc.pc) return; for (const c of rc.pending.splice(0)) { try { await rc.pc.addIceCandidate(c) } catch {} } }
async function rcOnSignal(p) {
  if (!p || !isId(p.from) || !members.some(m => m.user_id === p.from) || p.from === me) return;
  const mine = rc && rc.sid === p.sid && rc.peer === p.from;
  try {
    switch (p.k) {
      case 'request':
        if (rc || rcIncoming) return rcSend(p.from, { k: 'busy', sid: p.sid }).catch(() => {});
        rcIncoming = { sid: p.sid, from: p.from, control: !!p.control };
        rcIncoming.timer = setTimeout(() => { if (rcIncoming && rcIncoming.sid === p.sid) { rcIncoming = null; closeModal() } }, 60000);
        QG.rcAttention(); QG.notify('Contrôle à distance', `${nm(p.from)} veut ${p.control ? 'prendre le contrôle de ton PC' : 'voir ton écran'}`, 'remote');
        return rcAsk();
      case 'cancel': if (rcIncoming && rcIncoming.sid === p.sid) { clearTimeout(rcIncoming.timer); rcIncoming = null; closeModal(); toast(`${nm(p.from)} a annulé sa demande.`) } return;
      case 'decline': case 'busy': if (mine && rc.role === 'viewer') { rcEnd(false); toast(p.k === 'busy' ? `${nm(p.from)} est déjà dans une session.` : `${nm(p.from)} a refusé.`) } return;
      case 'offer': if (mine && rc.role === 'viewer') return rcOnOffer(p); return;
      case 'answer': if (mine && rc.role === 'host') { await rc.pc.setRemoteDescription(p.sdp); await rcFlush() } return;
      case 'ice': if (mine && p.c) { if (rc.pc && rc.pc.remoteDescription) { try { await rc.pc.addIceCandidate(p.c) } catch {} } else rc.pending.push(p.c) } return;
      case 'stop': if (mine) { rcEnd(false); toast(`Session terminée par ${nm(p.from)}.`) } return;
    }
  } catch (e) { toast('Erreur de session : ' + e.message); rcEnd(true) }
}
function rcAsk() {
  const inc = rcIncoming; if (!inc) return;
  openModal('Contrôle à distance', `<p><b>${esc(nm(inc.from))}</b> veut ${inc.control ? 'prendre le contrôle de ton PC' : 'voir ton écran'}.</p>
${inc.control ? '<label class="chk"><input type="checkbox" name="allow" checked> Autoriser la souris et le clavier</label>' : ''}
<p class="sub">Un bandeau rouge restera affiché en haut de ton écran pendant toute la session, avec un bouton pour tout arrêter. Les fenêtres administrateur de Windows ne peuvent pas être contrôlées à distance.</p>`,
    v => { rcAccept(inc.control && v.allow === 'on'); return true }, 'Accepter');
  const c = $('#mcancel'); c.textContent = 'Refuser';
  c.onclick = () => { if (rcIncoming && rcIncoming.sid === inc.sid) { clearTimeout(inc.timer); rcSend(inc.from, { k: 'decline', sid: inc.sid }).catch(() => {}); rcIncoming = null } c.textContent = 'Annuler'; c.onclick = closeModal; closeModal() };
}
async function rcRequest(id, control) {
  if (rc) return toast('Une session est déjà en cours.');
  if (!online.has(id)) return toast(`${nm(id)} n'est pas en ligne.`);
  rc = { sid: crypto.randomUUID(), role: 'viewer', peer: id, state: 'waiting', wantControl: control, allowControl: false, control: false, pending: [] };
  location.hash = 'remote'; render();
  try { await rcSend(id, { k: 'request', sid: rc.sid, control }) } catch (e) { toast("Impossible d'envoyer la demande : " + e.message); rc = null; return render() }
  const sid = rc.sid;
  rc.timer = setTimeout(() => { if (rc && rc.sid === sid && rc.state === 'waiting') { rcSend(id, { k: 'cancel', sid }).catch(() => {}); rcEnd(false); toast(`${nm(id)} n'a pas répondu.`) } }, 60000);
}
async function rcAccept(allowControl) {
  const inc = rcIncoming; if (!inc) return; clearTimeout(inc.timer); rcIncoming = null;
  $('#mcancel').textContent = 'Annuler'; $('#mcancel').onclick = closeModal;
  rc = { sid: inc.sid, role: 'host', peer: inc.from, state: 'connecting', allowControl, pending: [] };
  try {
    await QG.rcCapture(true);
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio: false });
    if (!rc || rc.sid !== inc.sid) { stream.getTracks().forEach(t => t.stop()); return }
    rc.stream = stream;
    const pc = rc.pc = rcPeer();
    stream.getVideoTracks().forEach(t => { t.contentHint = 'detail'; pc.addTrack(t, stream); t.onended = () => rcEnd(true) });
    const dc = rc.dc = pc.createDataChannel('ctl', { ordered: true });
    dc.onmessage = e => { if (rc && rc.role === 'host' && rc.allowControl) { try { const m = JSON.parse(e.data); if (m && typeof m === 'object') QG.rcInput(m) } catch {} } };
    await pc.setLocalDescription(await pc.createOffer());
    await rcSend(rc.peer, { k: 'offer', sid: rc.sid, sdp: sdpOf(pc.localDescription), allowControl });
    QG.rcSession({ active: true, control: allowControl, name: nm(rc.peer) });
    rc.timer = setTimeout(() => { if (rc && rc.sid === inc.sid && rc.state !== 'live') { toast("La connexion n'a pas pu s'établir."); rcEnd(true) } }, 30000);
    location.hash = 'remote'; render();
  } catch (e) {
    QG.rcCapture(false); rcSend(inc.from, { k: 'decline', sid: inc.sid }).catch(() => {});
    rcEnd(false); toast("Impossible de partager l'écran : " + e.message);
  }
}
async function rcOnOffer(p) {
  clearTimeout(rc.timer);
  rc.allowControl = !!p.allowControl; rc.state = 'connecting';
  const pc = rc.pc = rcPeer();
  pc.ontrack = e => { if (!rc || rc.pc !== pc) return; rcVideo.srcObject = e.streams[0] || new MediaStream([e.track]); rcVideo.play().catch(() => {}); render() };
  pc.ondatachannel = e => { if (rc && rc.pc === pc) rc.dc = e.channel };
  await pc.setRemoteDescription(p.sdp); await rcFlush();
  await pc.setLocalDescription(await pc.createAnswer());
  await rcSend(rc.peer, { k: 'answer', sid: rc.sid, sdp: sdpOf(pc.localDescription) });
  const sid = rc.sid;
  rc.timer = setTimeout(() => { if (rc && rc.sid === sid && rc.state !== 'live') { toast("La connexion n'a pas pu s'établir : un des réseaux bloque peut-être ce type de connexion."); rcEnd(true) } }, 30000);
  render();
}
function rcEnd(notify) {
  if (!rc) return; const s = rc; rc = null; clearTimeout(s.timer);
  if (notify) rcSend(s.peer, { k: s.state === 'waiting' ? 'cancel' : 'stop', sid: s.sid }).catch(() => {});
  if (s.control && s.dc && s.dc.readyState === 'open') { try { s.dc.send(JSON.stringify({ t: 'rel' })) } catch {} }
  try { s.dc && s.dc.close() } catch {} try { s.pc && s.pc.close() } catch {}
  if (s.role === 'host') { if (s.stream) s.stream.getTracks().forEach(t => t.stop()); QG.rcSession({ active: false }) }
  rcVideo.srcObject = null; if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  render();
}
QG.onRcStop(() => rcEnd(true));
window.addEventListener('beforeunload', () => { if (rc) rcEnd(true) });

// Commandes envoyées par celui qui contrôle
const rcSendCtl = m => { if (rc && rc.role === 'viewer' && rc.control && rc.dc && rc.dc.readyState === 'open') rc.dc.send(JSON.stringify(m)) };
function rcPos(e) {
  const r = rcVideo.getBoundingClientRect(), vw = rcVideo.videoWidth || 16, vh = rcVideo.videoHeight || 9;
  const s = Math.min(r.width / vw, r.height / vh), w = vw * s, h = vh * s, ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
  return { x: (e.clientX - ox) / w, y: (e.clientY - oy) / h };
}
let rcLastMove = 0;
rcVideo.addEventListener('mousemove', e => { const n = performance.now(); if (n - rcLastMove < 16) return; rcLastMove = n; const p = rcPos(e); if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) rcSendCtl({ t: 'mm', ...p }) });
rcVideo.addEventListener('mousedown', e => { if (!rc || !rc.control) return; e.preventDefault(); rcVideo.focus(); rcSendCtl({ t: 'md', b: e.button, ...rcPos(e) }) });
rcVideo.addEventListener('mouseup', e => { if (!rc || !rc.control) return; e.preventDefault(); rcSendCtl({ t: 'mu', b: e.button, ...rcPos(e) }) });
rcVideo.addEventListener('contextmenu', e => { if (rc && rc.control) e.preventDefault() });
rcVideo.addEventListener('wheel', e => { if (!rc || !rc.control) return; e.preventDefault(); rcSendCtl({ t: 'wh', dy: e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY }) }, { passive: false });
rcVideo.addEventListener('keydown', e => { if (!rc || !rc.control) return; e.preventDefault(); e.stopPropagation(); rcSendCtl({ t: "kd", code: e.code }) });
rcVideo.addEventListener('keyup', e => { if (!rc || !rc.control) return; e.preventDefault(); e.stopPropagation(); rcSendCtl({ t: 'ku', code: e.code }) });
rcVideo.addEventListener('blur', () => { if (rc && rc.control) rcSendCtl({ t: 'rel' }) });

function vRemote() {
  const head = `<div class="bar"><div><h2>Contrôle à distance</h2><p class="sub">Voir l'écran d'un membre ou prendre la main sur son PC, avec son accord.</p></div></div>`;
  if (rc && rc.role === 'viewer') {
    const st = rc.state === 'waiting' ? `En attente de la réponse de ${esc(nm(rc.peer))}…` : rc.state === 'live' ? (rc.control ? 'Tu contrôles ce PC. Clique sur l\'image puis utilise ta souris et ton clavier.' : (rc.allowControl ? 'Tu vois l\'écran. Clique sur « Prendre la main » pour contrôler.' : 'Tu vois l\'écran (lecture seule).')) : 'Connexion en cours…';
    return `${head}<div class="rcbar panel"><div class="rcwho">${avatar(rc.peer, true)}<span class="dmmid"><b>${esc(nm(rc.peer))}</b><small>${st}</small></span></div>
<div class="row">${rc.state === 'live' && rc.allowControl ? `<button class="${rc.control ? '' : 'pri'}" data-act="rctoggle">${rc.control ? 'Rendre la main' : 'Prendre la main'}</button>` : ''}${rc.state === 'live' ? '<button data-act="rcfull">Plein écran</button>' : ''}<button class="danger" data-act="rcstop">${rc.state === 'waiting' ? 'Annuler' : 'Arrêter'}</button></div></div>
<div class="rcstage${rc.control ? ' ctl' : ''}" id="rcslot">${rc.state !== 'live' ? '<div class="rcwait"><span class="spin"></span></div>' : ''}</div>`;
  }
  if (rc && rc.role === 'host') {
    return `${head}<div class="panel rchost"><div class="rcwho">${avatar(rc.peer, true)}<span class="dmmid"><b>${esc(nm(rc.peer))} ${rc.allowControl ? 'peut contrôler ton PC' : 'voit ton écran'}</b><small>${rc.state === 'live' ? 'Session en cours. Le bandeau rouge en haut de ton écran le rappelle.' : 'Connexion en cours…'}</small></span></div>
<div class="row"><button class="danger" data-act="rcstop">Arrêter le partage</button></div></div>`;
  }
  const others = members.filter(m => m.user_id !== me).sort((x, y) => (online.has(y.user_id) - online.has(x.user_id)) || String(x.name).localeCompare(String(y.name)));
  return `${head}<div class="grid2">
<section class="panel"><h3>Membres</h3>${others.map(m => { const on = online.has(m.user_id); return `<div class="mem"><span class="rcwho">${avatar(m.user_id)}<span class="dmmid"><b>${esc(m.name)}</b><small>${esc(seenText(m))}</small></span></span>
<span class="row"><button class="sm" data-act="rcview" data-id="${esc(m.user_id)}"${on ? '' : ' disabled'}>Voir l'écran</button><button class="sm pri" data-act="rcctl" data-id="${esc(m.user_id)}"${on ? '' : ' disabled'}>Prendre le contrôle</button></span></div>` }).join('') || '<p class="empty">Invite des membres pour utiliser le contrôle à distance.</p>'}</section>
<section class="panel"><h3>Comment ça marche</h3><div class="li"><b class="d">1</b><span>Tu envoies une demande à un membre en ligne.</span></div><div class="li"><b class="d">2</b><span>Il accepte ou refuse. Rien ne se passe sans son accord, et il peut n'autoriser que la vue.</span></div><div class="li"><b class="d">3</b><span>L'image passe directement entre vos deux PC, sans serveur au milieu.</span></div><div class="li"><b class="d">4</b><span>Chacun peut tout arrêter à tout moment. Chez lui, un bandeau rouge reste visible pendant la session.</span></div></section>
</div>`;
}

// ---------- Notes sur les tâches ----------
const tnOf = id => S.task_notes.filter(n => n.task === id);
const tnItem = n => `<div class="tn"><button type="button" class="profb" data-prof="${esc(n.author)}" aria-label="Profil de ${esc(nm(n.author))}">${avatar(n.author)}</button><div class="tnb"><div class="tnm"><b>${esc(nm(n.author))}</b><span>${esc(ago(n.at))}</span>${n.author === me ? `<button type="button" class="x" data-tn="del" data-id="${esc(n.id)}" aria-label="Supprimer la note">×</button>` : ''}</div><div class="tnt">${rich(n.body)}</div></div></div>`;
function tnBlock(t) {
  if (!tnReady) return `<div class="tnotes"><p class="sub">Pour ajouter des notes aux tâches, lance <b>supabase-update-0.5.2.sql</b> dans Supabase &gt; SQL Editor.</p></div>`;
  const ns = tnOf(t.id);
  return `<div class="tnotes"><div class="tnh">Notes <span>${ns.length}</span></div><div class="tnlist" id="tnlist" data-task="${esc(t.id)}">${ns.map(tnItem).join('') || '<p class="empty">Aucune note pour l’instant. Toute l’équipe peut en ajouter.</p>'}</div>
<div class="tnadd"><textarea id="tntext" rows="2" maxlength="2000" placeholder="Ajouter une note… (Ctrl+Entrée pour envoyer)" aria-label="Nouvelle note"></textarea><button type="button" class="pri" data-tn="add" data-id="${esc(t.id)}">Ajouter</button></div></div>`;
}
function refreshTn() {
  const l = $('#tnlist'); if (!l) return; const ns = tnOf(l.dataset.task);
  const atBot = l.scrollHeight - l.scrollTop - l.clientHeight < 40;
  l.innerHTML = ns.map(tnItem).join('') || '<p class="empty">Aucune note pour l’instant. Toute l’équipe peut en ajouter.</p>';
  const h = l.parentElement.querySelector('.tnh span'); if (h) h.textContent = ns.length; if (atBot) l.scrollTop = l.scrollHeight;
}
async function tnAdd(task) {
  const ta = $('#tntext'); if (!ta) return; const body = ta.value.trim(); if (!body) return ta.focus();
  ta.value = ''; ta.disabled = true;
  const { data, error } = await sb.from('task_notes').insert({ task, body: body.slice(0, 2000) }).select().single();
  ta.disabled = false; ta.focus();
  if (error) { ta.value = body; return toast(/relation|does not exist|schema cache/i.test(error.message || '') ? 'Lance supabase-update-0.5.2.sql dans Supabase pour activer les notes.' : errMsg(error)) }
  if (data && !S.task_notes.some(n => n.id === data.id)) S.task_notes.push(data);
  refreshTn(); const l = $('#tnlist'); if (l) l.scrollTop = l.scrollHeight; if (view === 'taches') render();
}
async function tnDel(id) {
  const n = S.task_notes.find(x => x.id === id); if (!n) return;
  S.task_notes = S.task_notes.filter(x => x !== n); refreshTn();
  const { error } = await sb.from('task_notes').delete().eq('id', id); if (error) { toast(errMsg(error)); reload('task_notes') } else if (view === 'taches') render();
}
$('#mbody').addEventListener('click', e => { const b = e.target.closest('[data-tn]'); if (!b) return; e.preventDefault(); e.stopPropagation(); if (b.dataset.tn === 'add') tnAdd(b.dataset.id); else tnDel(b.dataset.id) });
$('#mbody').addEventListener('keydown', e => { if (e.target.id === 'tntext' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const b = $('#mbody [data-tn=add]'); if (b) tnAdd(b.dataset.id) } });

// ---------- Glisser-déposer des fichiers entre dossiers ----------
let dragFile = null;
main.addEventListener('dragstart', e => {
  const r = e.target.closest && e.target.closest('.frow[data-fid]'); if (!r || view !== 'fichiers') return;
  dragFile = r.dataset.fid; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'qg-file:' + dragFile) } catch {}
  setTimeout(() => r.classList.add('dragging'));
});
main.addEventListener('dragend', () => { dragFile = null; document.querySelectorAll('.frow.dragging,.fold.over').forEach(x => x.classList.remove('dragging', 'over')) });
main.addEventListener('dragover', e => {
  if (!dragFile) return; const fo = e.target.closest && e.target.closest('.fold[data-id]'); if (!fo || fo.dataset.id === 'Tous') return;
  e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.fold.over').forEach(x => { if (x !== fo) x.classList.remove('over') }); fo.classList.add('over');
}, true);
main.addEventListener('drop', async e => {
  if (!dragFile) return; const fo = e.target.closest && e.target.closest('.fold[data-id]'); if (!fo || fo.dataset.id === 'Tous') return;
  e.preventDefault(); e.stopPropagation(); const id = dragFile, to = fo.dataset.id; dragFile = null; fo.classList.remove('over');
  const f = S.files.find(x => x.id === id); if (!f) return render();
  // déplace aussi les autres versions du même nom dans le même espace
  const group = (fileGroups(spOf(f)).get(fkey(f)) || [f]).filter(x => x.folder !== to); if (!group.length) return render();
  const prev = group.map(x => [x.id, x.folder]); group.forEach(x => x.folder = to); render();
  const { error } = await sb.from('files').update({ folder: to }).in('id', group.map(x => x.id));
  if (error) { prev.forEach(([id, fo]) => { const x = S.files.find(y => y.id === id); if (x) x.folder = fo }); render(); toast(errMsg(error)) }
  else toast(group.length > 1 ? `${group.length} versions de « ${f.name} » déplacées dans ${to}` : `« ${f.name} » déplacé dans ${to}`);
}, true);

// ---------- Glisser-déposer des tâches ----------
let dragTask = null;
main.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('.task[data-task]'); if (!c || view !== 'taches') return;
  dragTask = c.dataset.task; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'qg-task:' + dragTask);
  setTimeout(() => c.classList.add('dragging'));
});
main.addEventListener('dragend', () => { dragTask = null; document.querySelectorAll('.task.dragging,.col.over').forEach(x => x.classList.remove('dragging', 'over')) });
main.addEventListener('dragover', e => {
  if (!dragTask) return; const col = e.target.closest && e.target.closest('.col[data-col]'); if (!col) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.col.over').forEach(x => { if (x !== col) x.classList.remove('over') }); col.classList.add('over');
});
main.addEventListener('drop', async e => {
  if (!dragTask) return; const col = e.target.closest && e.target.closest('.col[data-col]'); if (!col) return;
  e.preventDefault(); e.stopPropagation(); const id = dragTask, to = col.dataset.col; dragTask = null; col.classList.remove('over');
  const t = S.tasks.find(x => x.id === id); if (!t || t.status === to) return render();
  const prev = t.status; t.status = to; render();
  const { error } = await sb.from('tasks').update({ status: to, upd: new Date().toISOString() }).eq('id', id);
  if (error) { t.status = prev; render(); toast(errMsg(error)) } else toast(`« ${t.title} » → ${(ST.find(s => s[0] === to) || [, to])[1]}`);
});

// ---------- Profils des membres ----------
const ROLES = ['Fondateur', 'Admin', 'Développeur', 'Scripteur', 'Mappeur', 'Graphiste', 'Testeur', 'Modérateur'];
const okAvPath = p => typeof p === 'string' && /^avatars\/[\w-]+\/[\w.\-]+$/.test(p);
const memberOf = id => members.find(m => m.user_id === id);
const avUrl = id => { const m = memberOf(id); return m && okAvPath(m.avatar) && imgs[m.avatar] ? imgs[m.avatar].u : null };
const avInner = id => { const u = avUrl(id); return u ? `<img src="${esc(u)}" alt="">` : esc((nm(id)[0] || '?').toUpperCase()) };
async function ensureAvatars() {
  const now = Date.now();
  const todo = [...new Set(members.map(m => m.avatar).filter(okAvPath))].filter(p => !(imgs[p] && imgs[p].exp > now + 6e4) && !imgWait.has(p));
  if (!todo.length || !sb) return; todo.forEach(p => imgWait.add(p));
  try { const { data } = await sb.storage.from('files').createSignedUrls(todo, 3600); (data || []).forEach(d => { if (d && d.signedUrl && d.path) imgs[d.path] = { u: d.signedUrl, exp: now + 3500e3 } }) } catch {}
  todo.forEach(p => imgWait.delete(p)); if (phase === 'app') { render(); renderMe() }
}
setInterval(() => { if (phase === 'app') ensureAvatars() }, 300000);
function profileEditor() {
  const m = memberOf(me) || {};
  if (!profReady) return `<section class="panel"><h3>Mon pseudo</h3><form id="namef" class="row"><input id="myname" name="name" maxlength="40" value="${esc(names[me] || '')}" required style="flex:1"><button class="pri">Enregistrer</button></form><p class="sub" style="margin-top:10px">Pour ajouter une photo, un rôle et une bio, lance <b>supabase-update-0.5.sql</b> dans Supabase &gt; SQL Editor, puis redémarre l'appli.</p></section>`;
  return `<section class="panel"><h3>Mon profil</h3>
<div class="profed"><span class="av xl">${avInner(me)}</span><div class="profbtns"><button type="button" data-pick="avin">${m.avatar ? 'Changer la photo' : 'Ajouter une photo'}</button>${m.avatar ? '<button class="ghost sm" data-act="avdel">Retirer la photo</button>' : ''}<small class="sub">PNG, JPG ou WebP. Elle est recadrée en carré automatiquement.</small></div></div>
<form id="namef" class="pform"><label>Pseudo<input id="myname" name="name" maxlength="40" value="${esc(names[me] || '')}" required></label>
<label>Rôle dans l'équipe<input id="myrole" name="role" maxlength="40" list="qgroles" value="${esc(m.role || '')}" placeholder="Ex. Scripteur, Mappeur…"></label><datalist id="qgroles">${ROLES.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
<label>Bio<textarea id="mybio" name="bio" rows="3" maxlength="300" placeholder="Quelques mots sur toi : ce que tu fais sur le projet, tes horaires…">${esc(m.bio || '')}</textarea></label>
<div class="row end"><button class="pri">Enregistrer</button></div></form></section>`;
}
async function avatarUpload(file) {
  if (!profReady) return toast('Lance d’abord supabase-update-0.5.sql dans Supabase.');
  if (!/^image\//.test(file.type || '')) return toast('Choisis une image (PNG, JPG ou WebP).');
  if (file.size > 15 * 1048576) return toast('Image trop lourde (15 Mo max).');
  let blob;
  try {
    const bmp = await createImageBitmap(file); const S0 = Math.min(bmp.width, bmp.height), N = 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    cv.getContext('2d').drawImage(bmp, (bmp.width - S0) / 2, (bmp.height - S0) / 2, S0, S0, 0, 0, N, N);
    blob = await new Promise(r => cv.toBlob(r, 'image/webp', 0.9)); if (!blob) blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  } catch { return toast('Impossible de lire cette image.') }
  toast('Envoi de la photo…');
  const old = (memberOf(me) || {}).avatar, path = `avatars/${me}/${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
  const { error } = await sb.storage.from('files').upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) return toast('Photo non envoyée : ' + errMsg(error));
  imgs[path] = { u: URL.createObjectURL(blob), exp: Date.now() + 864e5 };
  const { error: e2 } = await sb.from('members').update({ avatar: path }).eq('user_id', me);
  if (e2) { sb.storage.from('files').remove([path]).then(() => {}, () => {}); return toast(sqlHint(e2).replace('0.4', '0.5')) }
  if (okAvPath(old)) sb.storage.from('files').remove([old]).then(() => {}, () => {});
  const m = memberOf(me); if (m) m.avatar = path; toast('Photo de profil mise à jour'); render(); renderMe(); renderDM(); loadMembers();
}
async function avatarDelete() {
  const m = memberOf(me); if (!m || !m.avatar) return; const old = m.avatar;
  if (!await w(sb.from('members').update({ avatar: null }).eq('user_id', me))) return;
  if (okAvPath(old)) sb.storage.from('files').remove([old]).then(() => {}, () => {});
  m.avatar = null; toast('Photo retirée'); render(); renderMe(); loadMembers();
}
function showProfile(id) {
  const m = memberOf(id); if (!m) return; closePop();
  const mine = id === me, on = online.has(id);
  openModal(mine ? 'Mon profil' : 'Profil', `<div class="prof"><span class="av xxl${on ? ' on st-' + statusOf(id) : ''}">${avInner(id)}</span><b class="pname">${esc(m.name)}</b>${m.role ? `<span class="role">${esc(m.role)}</span>` : ''}<small class="pseen">${on ? `<i class="sd st-${statusOf(id)}"></i>` : ''}${esc(seenText(m))}</small>${m.bio ? `<p class="pbio">${esc(m.bio)}</p>` : `<p class="pbio empty2">${mine ? 'Tu n’as pas encore de bio. Ajoute-la dans Paramètres.' : 'Pas encore de bio.'}</p>`}<small class="sub">Membre depuis le ${esc(new Date(ts(m.joined_at)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}</small></div>`,
    () => { if (mine) location.hash = 'parametres'; else openDm(id); return true }, mine ? 'Modifier mon profil' : 'Envoyer un message');
  const c = $('#mcancel'); c.textContent = 'Fermer'; c.onclick = () => { c.textContent = 'Annuler'; c.onclick = closeModal; closeModal() };
}
document.addEventListener('click', e => { const p = e.target.closest('[data-prof]'); if (!p) return; e.preventDefault(); showProfile(p.dataset.prof) });

// ---------- Historique des fichiers ----------
// Les fichiers qui portent le même nom dans un espace sont les versions d'un même fichier.
const fkey = f => (f.kind === 'upload' || f.kind === 'gofile') ? spOf(f) + '|' + String(f.name || '').trim().toLowerCase() : 'id|' + f.id;
function fileGroups(sp = space) { const g = new Map(); for (const f of S.files) { if (spOf(f) !== sp) continue; const k = fkey(f); if (!g.has(k)) g.set(k, []); g.get(k).push(f) } for (const v of g.values()) v.sort((x, y) => ts(y.at) - ts(x.at)); return g }
const curFiles = () => [...fileGroups().values()].map(v => ({ f: v[0], n: v.length })).sort((x, y) => ts(y.f.at) - ts(x.f.at));
const verCount = (name, sp) => (fileGroups(sp).get(sp + '|' + String(name || '').trim().toLowerCase()) || []).length;
function fileHistory(id) {
  const f = S.files.find(x => x.id === id); if (!f) return;
  const v = fileGroups(spOf(f)).get(fkey(f)) || [f], n = v.length;
  openModal(`Historique de « ${f.name} »`, `<p class="sub">${n} version${n > 1 ? 's' : ''}. La plus récente est celle que tout le monde voit dans la liste.</p><div class="hist">${v.map((x, i) => `<div class="hrow${i === 0 ? ' cur' : ''}"><b class="hv">v${n - i}</b><span class="dmmid"><b>${i === 0 ? 'Version actuelle' : 'Ancienne version'}${x.kind === 'gofile' ? ' · Gofile' : ''}</b><small>${esc(nm(x.author))} · ${esc(ago(x.at))}${x.size ? ' · ' + esc(size(x.size)) : ''}${x.folder ? ' · ' + esc(x.folder) : ''}</small></span><span class="row"><button type="button" class="sm" data-act="openfile" data-id="${esc(x.id)}">${x.kind === 'upload' ? 'Télécharger' : 'Ouvrir'}</button><button type="button" class="sm ghost" data-act="delfile" data-id="${esc(x.id)}" aria-label="Supprimer la version ${n - i}">Supprimer</button></span></div>`).join('')}</div>`, () => true, 'Fermer');
  const c = $('#mcancel'); if (c) c.style.display = 'none';
}
$('#mbody').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault(); const a = b.dataset.act; if (a === 'delfile' || a === 'openfile') { if (a === 'delfile') closeModal(); act(a, b.dataset.id, b) } });

// ---------- Blocs de code colorés ----------
const KW = {
  lua: 'and break do else elseif end false for function goto if in local nil not or repeat return then true until while',
  js: 'async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
  cpp: 'auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern false float for friend goto if inline int long namespace new nullptr operator override private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while size_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t std string vector DWORD BYTE HANDLE',
  json: 'true false null'
};
const KWS = Object.fromEntries(Object.entries(KW).map(([k, v]) => [k, new Set(v.split(' '))]));
const LANG = { lua: 'lua', luau: 'lua', js: 'js', javascript: 'js', ts: 'js', typescript: 'js', jsx: 'js', tsx: 'js', node: 'js', json: 'json', cpp: 'cpp', 'c++': 'cpp', c: 'cpp', h: 'cpp', hpp: 'cpp', cc: 'cpp', cs: 'cpp', 'c#': 'cpp', csharp: 'cpp', txt: 'txt', text: 'txt' };
const LNAME = { lua: 'Lua', js: 'JavaScript', cpp: 'C / C++', json: 'JSON', txt: 'Code' };
function guessLang(s) {
  if (/^\s*[{[]/.test(s) && /"\s*:/.test(s)) return 'json';
  if (/#include|std::|\bint\s+main\b|->|::/.test(s)) return 'cpp';
  if (/\blocal\s+\w|\bthen\b|\bend\b|--|~=|\.\./.test(s)) return 'lua';
  if (/\b(const|let|var|function|=>|console\.|require\(|import\s)/.test(s)) return 'js';
  return 'txt';
}
const RE_ID = /[A-Za-z_]\w*/y, RE_NUM = /0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, RE_CALL = /\s*\(/y;
function hl(s, lang) {
  if (lang === 'txt') return esc(s);
  const kw = KWS[lang] || new Set(), n = s.length, line = lang === 'lua' ? '--' : lang === 'json' ? null : '//';
  const sp = (c, a, b) => `<span class="t-${c}">${esc(s.slice(a, b))}</span>`;
  let o = '', i = 0, plain = 0;
  const flush = () => { if (plain < i) o += esc(s.slice(plain, i)) };
  while (i < n) {
    const c = s[i]; let j = -1, cls = '';
    if (lang === 'lua' && s.startsWith('--[[', i)) { const e = s.indexOf(']]', i + 4); j = e < 0 ? n : e + 2; cls = 'c' }
    else if ((lang === 'js' || lang === 'cpp') && s.startsWith('/*', i)) { const e = s.indexOf('*/', i + 2); j = e < 0 ? n : e + 2; cls = 'c' }
    else if (line && s.startsWith(line, i)) { const e = s.indexOf('\n', i); j = e < 0 ? n : e; cls = 'c' }
    else if (lang === 'cpp' && c === '#' && /(^|\n)[ \t]*$/.test(s.slice(Math.max(0, i - 40), i))) { const e = s.indexOf('\n', i); j = e < 0 ? n : e; cls = 'p' }
    else if (lang === 'lua' && s.startsWith('[[', i)) { const e = s.indexOf(']]', i + 2); j = e < 0 ? n : e + 2; cls = 's' }
    else if (c === '"' || c === "'" || (c === '`' && lang === 'js')) { j = i + 1; while (j < n && s[j] !== c && (c === '`' || s[j] !== '\n')) { if (s[j] === '\\') j++; j++ } j = Math.min(n, j + 1); cls = 's' }
    else if (c >= '0' && c <= '9' && !/\w/.test(s[i - 1] || '')) { RE_NUM.lastIndex = i; const m = RE_NUM.exec(s); if (m) { j = i + m[0].length; cls = 'n' } }
    else if (/[A-Za-z_]/.test(c) && !/\w/.test(s[i - 1] || '')) { RE_ID.lastIndex = i; const m = RE_ID.exec(s); j = i + m[0].length; if (kw.has(m[0])) cls = 'k'; else { RE_CALL.lastIndex = j; if (RE_CALL.test(s)) cls = 'f'; else { i = j; continue } } }
    if (j > i && cls) { flush(); o += sp(cls, i, j); i = plain = j } else i++;
  }
  i = n; flush(); return o;
}
const inline = t => esc(t).replace(/`([^`\n]{1,300})`/g, '<code class="ic">$1</code>');
function rich(t) {
  t = String(t || ''); if (!t.includes('`')) return esc(t);
  const re = /```([\w+#.-]{0,20})[^\S\n]*\n?([\s\S]*?)(?:```|$)/g; let o = '', last = 0, m;
  while ((m = re.exec(t))) {
    if (m[0] === '') { re.lastIndex++; continue }
    o += inline(t.slice(last, m.index).replace(/\n$/, ''));
    const tag = m[1].toLowerCase(), code = m[2].replace(/\n$/, ''), lang = LANG[tag] || (tag ? 'txt' : guessLang(code));
    o += `<div class="cb"><div class="cbh"><span>${esc(LNAME[lang] === 'Code' && tag ? tag : LNAME[lang])}</span><button type="button" class="cbcopy" data-copycode>Copier</button></div><pre><code>${hl(code, lang)}</code></pre></div>`;
    last = re.lastIndex; if (t[last] === '\n') last++;
  }
  return o + inline(t.slice(last));
}
const inFence = ta => ((ta.value.slice(0, ta.selectionStart).match(/```/g) || []).length % 2) === 1;
const CODEI = '<svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>';
const codePick = id => `<button type="button" class="imgbtn" data-code="${id}" title="Insérer un bloc de code" aria-label="Insérer un bloc de code">${CODEI}</button>`;
let lastLang = (() => { try { return localStorage.getItem('qg.lang') || 'lua' } catch { return 'lua' } })();
function insertCode(id) {
  const ta = document.getElementById(id); if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e);
  const pre = (s > 0 && v[s - 1] !== '\n' ? '\n' : '') + '```' + lastLang + '\n', post = '\n```' + (v[e] && v[e] !== '\n' ? '\n' : '');
  ta.value = v.slice(0, s) + pre + sel + post + v.slice(e); const c = s + pre.length + sel.length;
  ta.focus(); ta.setSelectionRange(c, c); ta.dataset.dirty = 1; ta.dispatchEvent(new Event('input', { bubbles: true }));
}
document.addEventListener('click', e => {
  const cp = e.target.closest('[data-copycode]');
  if (cp) { e.preventDefault(); const code = cp.closest('.cb').querySelector('code').textContent; navigator.clipboard.writeText(code).then(() => { cp.textContent = 'Copié ✓'; cp.classList.add('ok'); setTimeout(() => { cp.textContent = 'Copier'; cp.classList.remove('ok') }, 1600) }, () => toast('Copie impossible')); return }
  const ic = e.target.closest('[data-code]'); if (ic) { e.preventDefault(); insertCode(ic.dataset.code) }
});
// retient le dernier langage utilisé pour le bouton </>
document.addEventListener('input', e => { if (!['ctext', 'dmtext', 'nbody'].includes(e.target.id)) return; const m = e.target.value.match(/```([A-Za-z+#]{1,12})\b(?![\s\S]*```[A-Za-z])/); if (m && LANG[m[1].toLowerCase()] && m[1] !== lastLang) { lastLang = m[1]; try { localStorage.setItem('qg.lang', lastLang) } catch {} } });

// ---------- Statut perso ----------
const STATUS = { dispo: { l: 'Disponible' }, code: { l: 'En train de coder' }, afk: { l: 'AFK' }, dnd: { l: 'Ne pas déranger' } };
const statusOf = id => { const s = id === me ? myStatus : (presMeta[id] || {}).status; return STATUS[s] ? s : 'dispo' };
const alert2 = (...a) => { if (myStatus !== 'dnd') QG.notify(...a) };
const bodyOf = d => String((d && d.body) || (d && d.img ? '📷 Image' : ''));
function renderMe() {
  const box = $('#mebox'); if (!box || phase !== 'app') return;
  const n = names[me] || '', s = statusOf(me);
  box.innerHTML = `<button class="mebtn" id="mestat" aria-haspopup="menu" aria-label="Mon compte : ${esc(n || 'Moi')}, ${esc(STATUS[s].l)}" title="${esc(n || 'Moi')} · ${esc(STATUS[s].l)}"><span class="av on st-${s}">${avInner(me)}</span></button>`;
}
function setStatus(s) {
  if (!STATUS[s]) return; myStatus = s; try { localStorage.setItem('qg.status', s) } catch {}
  if (pres) pres.track({ at: Date.now(), status: s }).catch(() => {});
  closePop(); renderMe(); renderDM();
  if (s === 'dnd') toast('Ne pas déranger : plus de son ni de notification Windows.');
}
let pop = null;
function closePop() { if (pop) { pop.remove(); pop = null } }
function openPop(anchor, html, cls) {
  closePop(); pop = document.createElement('div'); pop.className = 'pop ' + (cls || ''); pop.setAttribute('role', 'menu'); pop.innerHTML = html; document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = Math.min(Math.max(8, r.left), innerWidth - pw - 8), y = r.top - ph - 6; if (y < 8) y = r.bottom + 6; if (cls === 'stpop') { x = Math.max(8, r.right - pw); y = r.bottom + 8 }
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
  const f = pop.querySelector('button'); if (f) f.focus();
}
function statusMenu(anchor) {
  const n = names[me] || 'Moi';
  openPop(anchor, `<div class="pmhead"><span class="av big">${avInner(me)}</span><span><b>${esc(n)}</b><small>${esc(STATUS[statusOf(me)].l)}</small></span></div><div class="pmlbl">Statut</div>` + Object.entries(STATUS).map(([k, v]) => `<button role="menuitemradio" aria-checked="${k === myStatus}" data-st="${k}"><i class="sd st-${k}"></i>${esc(v.l)}${k === 'dnd' ? '<small>Coupe les sons et notifications</small>' : ''}</button>`).join('') + `<div class="pmsep"></div>${[['equipe', 'Équipe'], ['remote', 'Contrôle à distance'], ['notifications', 'Notifications'], ['parametres', 'Paramètres et profil']].map(([h, l]) => `<a role="menuitem" href="#${h}" data-close>${l}</a>`).join('')}`, 'stpop');
}

// ---------- Réactions emoji ----------
const EMO = ['👍', '❤️', '😂', '🔥', '😮', '😢', '👀', '✅'];
const rxTarget = r => r.msg || r.dm;
const SMILE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>';
const rxAdd = (k, id) => reactReady ? `<button class="rxadd" data-rxadd="${k}" data-id="${esc(id)}" aria-label="Ajouter une réaction" title="Réagir">${SMILE}</button>` : '';
function rxBar(k, id) {
  if (!reactReady) return '';
  const g = {}; for (const r of S.reactions) if (rxTarget(r) === id) (g[r.emoji] = g[r.emoji] || []).push(r.user_id);
  const ks = EMO.filter(e => g[e]).concat(Object.keys(g).filter(e => !EMO.includes(e)));
  if (!ks.length) return '';
  return `<div class="rxs">${ks.map(e => { const us = g[e]; return `<button class="rx${us.includes(me) ? ' mine' : ''}" data-rx="${k}" data-id="${esc(id)}" data-e="${esc(e)}" title="${esc(us.map(nm).join(', '))}" aria-pressed="${us.includes(me)}">${esc(e)}<b>${us.length}</b></button>` }).join('')}</div>`;
}
const rerender = k => k === 'dm' ? renderDM() : render();
async function toggleReact(k, id, e) {
  closePop(); if (!EMO.includes(e) && !S.reactions.some(r => r.emoji === e)) return;
  const mine = S.reactions.find(r => rxTarget(r) === id && r.user_id === me && r.emoji === e);
  if (mine) {
    S.reactions = S.reactions.filter(r => r !== mine); rerender(k);
    const { error } = await sb.from('reactions').delete().eq('id', mine.id); if (error) { toast(errMsg(error)); reload('reactions') } return;
  }
  const row = { user_id: me, emoji: e }; row[k === 'dm' ? 'dm' : 'msg'] = id;
  const tmp = { ...row, id: 'tmp' + Math.random(), at: new Date().toISOString() }; S.reactions.unshift(tmp); rerender(k);
  const { data, error } = await sb.from('reactions').insert(row).select().single();
  S.reactions = S.reactions.filter(r => r !== tmp);
  if (error) { toast(sqlHint(error)); reload('reactions'); return rerender(k) }
  if (data && !S.reactions.some(r => r.id === data.id)) S.reactions.unshift(data); rerender(k);
}
function rxMenu(anchor, k, id) { openPop(anchor, EMO.map(e => `<button data-rxe="${esc(e)}" data-k="${k}" data-id="${esc(id)}" aria-label="Réagir ${e}">${e}</button>`).join(''), 'rxpop') }
const sqlHint = e => /column|schema cache|relation|does not exist|violates check/i.test(String(e && e.message || '')) ? 'Mise à jour du serveur nécessaire : lance supabase-update-0.4.sql dans Supabase > SQL Editor.' : errMsg(e);

// ---------- Images dans la discussion ----------
const pend = { chat: [], dm: [] }, imgs = {}, imgWait = new Set();
const IMG_MAX = 10 * 1048576;
const isImg = f => f && /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(f.type || '');
const IMGI = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';
const imgPick = id => `<button type="button" class="imgbtn" data-pick="${id}" title="Envoyer une image" aria-label="Envoyer une image">${IMGI}</button>`;
const imgQueue = k => pend[k].length ? `<div class="imgq">${pend[k].map((p, i) => `<span class="qimg"><img src="${esc(p.url)}" alt="${esc(p.file.name)}"><button type="button" class="x" ${k === 'dm' ? 'data-dm="unimg"' : 'data-act="unimg"'} data-id="${i}" aria-label="Retirer l'image">×</button></span>`).join('')}<small>${pend[k].length > 1 ? pend[k].length + ' images prêtes' : 'Image prête'} : ajoute un texte si tu veux, puis Envoyer.</small></div>` : '';
function addImgs(k, list) {
  let bad = 0, big = 0;
  for (const f of list) { if (!isImg(f)) { bad++; continue } if (f.size > IMG_MAX) { big++; continue } if (pend[k].length >= 6) break; pend[k].push({ file: f, url: URL.createObjectURL(f) }) }
  if (big) toast('Image trop lourde (10 Mo max). Pour les gros fichiers, passe par l’onglet Fichiers.'); else if (bad) toast('Seules les images (PNG, JPG, GIF, WebP) vont dans la discussion.');
  rerender(k); const t = $(k === 'dm' ? '#dmtext' : '#ctext'); if (t) t.focus();
}
async function upImg(f) {
  const safe = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80) || 'image';
  const path = `chat/${crypto.randomUUID()}/${safe}`;
  const { error } = await sb.storage.from('files').upload(path, f, { contentType: f.type, upsert: false });
  if (error) { toast(`Image non envoyée : ${errMsg(error)}`); return null }
  imgs[path] = { u: URL.createObjectURL(f), exp: Date.now() + 864e5 };
  return path;
}
async function sendWithImages(text, list, insert) {
  if (!list.length) return insert(text, null);
  let textSent = !text, okAny = false;
  if (list.length) toast(list.length > 1 ? `Envoi de ${list.length} images…` : 'Envoi de l’image…');
  for (const p of list) {
    const path = await upImg(p.file); URL.revokeObjectURL(p.url); if (!path) continue;
    if (await insert(textSent ? '' : text, path)) { textSent = true; okAny = true } else sb.storage.from('files').remove([path]).then(() => {}, () => {});
  }
  if (!textSent) return insert(text, null);
  return okAny || textSent;
}
const okImgPath = p => typeof p === 'string' && /^chat\/[\w-]+\/[\w.\-]+$/.test(p);
const msgImg = p => !okImgPath(p) ? '' : imgs[p] ? `<button class="cimgb" data-img="${esc(p)}" aria-label="Agrandir l'image"><img class="cimg" src="${esc(imgs[p].u)}" alt="Image envoyée"></button>` : '<span class="cimg ph" aria-label="Chargement de l’image"></span>';
async function ensureImgs() {
  const now = Date.now();
  const todo = [...new Set([...S.messages, ...S.dms].map(m => m.img).filter(okImgPath))].filter(p => !(imgs[p] && imgs[p].exp > now + 6e4) && !imgWait.has(p)).slice(0, 100);
  if (!todo.length || !sb) return; todo.forEach(p => imgWait.add(p));
  try { const { data } = await sb.storage.from('files').createSignedUrls(todo, 3600); (data || []).forEach(d => { if (d && d.signedUrl && d.path) imgs[d.path] = { u: d.signedUrl, exp: now + 3500e3 } }) } catch {}
  todo.forEach(p => imgWait.delete(p)); if (phase === 'app') { if (view === 'discussion') render(); renderDM() }
}
setInterval(() => { if (phase === 'app') ensureImgs() }, 300000);
function lightbox(p) {
  let lb = $('#lbox'); if (!lb) { lb = document.createElement('div'); lb.id = 'lbox'; document.body.appendChild(lb) }
  lb.innerHTML = `<div class="lbin"><img src="${esc(imgs[p] ? imgs[p].u : '')}" alt="Image en grand"><div class="row end"><button data-lb="dl" data-img="${esc(p)}">Télécharger</button><button class="pri" data-lb="close">Fermer</button></div></div>`;
  lb.hidden = false; lb.querySelector('[data-lb=close]').focus();
}
async function dlImg(p) { const { data, error } = await sb.storage.from('files').createSignedUrl(p, 600, { download: p.split('/').pop() }); if (error || !data) return toast(errMsg(error)); QG.openExternal(data.signedUrl) }

// Clics globaux : statut, réactions, images
document.addEventListener('click', e => {
  const t = e.target;
  if (pop && !pop.contains(t) && !t.closest('#mestat,[data-rxadd]')) closePop();
  const ms = t.closest('#mestat'); if (ms) { e.preventDefault(); return pop && pop.classList.contains('stpop') ? closePop() : statusMenu(ms) }
  if (t.closest('[data-close]')) closePop();
  const st = t.closest('[data-st]'); if (st) { e.preventDefault(); return setStatus(st.dataset.st) }
  const ad = t.closest('[data-rxadd]'); if (ad) { e.preventDefault(); return pop && pop.classList.contains('rxpop') && pop.dataset.id === ad.dataset.id ? closePop() : (rxMenu(ad, ad.dataset.rxadd, ad.dataset.id), pop.dataset.id = ad.dataset.id) }
  const re = t.closest('[data-rxe]'); if (re) { e.preventDefault(); return toggleReact(re.dataset.k, re.dataset.id, re.dataset.rxe) }
  const rx = t.closest('[data-rx]'); if (rx) { e.preventDefault(); return toggleReact(rx.dataset.rx, rx.dataset.id, rx.dataset.e) }
  const lb = t.closest('[data-lb]'); if (lb) { e.preventDefault(); if (lb.dataset.lb === 'dl') return dlImg(lb.dataset.img); $('#lbox').hidden = true; return }
  if (t.id === 'lbox') { $('#lbox').hidden = true; return }
  const im = t.closest('[data-img]'); if (im) { e.preventDefault(); return lightbox(im.dataset.img) }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (pop) { closePop(); return }
  const lb = $('#lbox'); if (lb && !lb.hidden) lb.hidden = true;
});
window.addEventListener('resize', closePop);
// garde la discussion en bas quand une image finit de charger
document.addEventListener('load', e => { if (e.target.tagName !== 'IMG') return; const l = e.target.closest('#chatlog,#dmlog'); if (l && l.scrollHeight - l.scrollTop - l.clientHeight < e.target.clientHeight + 120) l.scrollTop = l.scrollHeight }, true);
// Les champs « choisir un fichier » vivent hors des zones redessinées : un re-rendu pendant le choix ne perd plus le fichier.
for (const [id, acc, multi] of [['cimgin', 'image/png,image/jpeg,image/gif,image/webp', true], ['dmimgin', 'image/png,image/jpeg,image/gif,image/webp', true], ['avin', 'image/png,image/jpeg,image/webp,image/gif', false]]) {
  const i = document.createElement('input'); i.type = 'file'; i.id = id; i.accept = acc; i.multiple = multi; i.hidden = true; i.tabIndex = -1; document.body.appendChild(i);
  i.addEventListener('change', () => { const l = [...i.files]; i.value = ''; if (!l.length) return; if (id === 'avin') avatarUpload(l[0]); else addImgs(id === 'dmimgin' ? 'dm' : 'chat', l) });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; e.preventDefault(); const i = document.getElementById(b.dataset.pick); if (i) i.click() });
$('#dm').addEventListener('paste', e => { if (e.target.id !== 'dmtext') return; const l = [...(e.clipboardData && e.clipboardData.files || [])].filter(isImg); if (l.length) { e.preventDefault(); addImgs('dm', l) } });
$('#dm').addEventListener('dragover', e => { if (!dmWith) return; e.preventDefault(); e.stopPropagation(); $('#dm').classList.add('drop') });
$('#dm').addEventListener('dragleave', e => { if (e.target.id === 'dm') $('#dm').classList.remove('drop') });
$('#dm').addEventListener('drop', e => { $('#dm').classList.remove('drop'); if (!dmWith) return; e.preventDefault(); e.stopPropagation(); const l = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (l.length) addImgs('dm', l) });
$('#dm').addEventListener('click', e => { const b = e.target.closest('[data-dm="unimg"]'); if (b) { e.preventDefault(); e.stopPropagation(); pend.dm.splice(+b.dataset.id, 1); renderDM() } }, true);

// ===================== Espace YouTube : Idées + Assistant IA =====================

// ---------- Tableau d'idées de vidéos ----------
const IST = [['idee', 'Idées'], ['tournage', 'À tourner'], ['montage', 'En montage'], ['publie', 'Publié']];
const istLabel = k => (IST.find(s => s[0] === k) || IST[0])[1];
function ideaCard(it) {
  const id = esc(it.id);
  return `<article class="task" draggable="true" data-idea="${id}"><div class="thead"><button class="tt" data-act="editidea" data-id="${id}">${esc(it.title || 'Sans titre')}</button><button class="tdel" data-act="delidea" data-id="${id}" aria-label="Supprimer l'idée" title="Supprimer l'idée"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></div>
${it.descr ? `<p>${esc(String(it.descr).slice(0, 160))}</p>` : ''}
<div class="meta"><span>${it.assignee ? esc(nm(it.assignee)) : 'Personne'}</span><span class="sub" style="margin-left:auto">${esc(ago(it.at))}</span></div></article>`;
}
function vIdees() {
  if (!ideasReady) return `<div class="bar"><div><h2>Idées de vidéos</h2></div></div><div class="notice">Les idées ont besoin d'une petite mise à jour du serveur : lance <b>supabase-update-0.8.sql</b> dans Supabase &gt; SQL Editor, puis redémarre l'appli.</div>`;
  const list = SP('ideas');
  return `<div class="bar"><div><h2>Idées de vidéos</h2><p class="sub">Du concept à la publication. Glisse une carte d'une colonne à l'autre, ou demande des idées à l'Assistant.</p></div><button class="pri" data-act="newidea">Nouvelle idée</button></div>
<div class="kanban k4">${IST.map(([k, l]) => { const col = list.filter(it => (IST.some(s => s[0] === it.status) ? it.status : 'idee') === k); return `<section class="col ci-${k}" data-ideacol="${k}"><h3><i></i>${l} <span>${col.length}</span></h3>${col.map(ideaCard).join('') || '<p class="empty">Rien ici.</p>'}</section>` }).join('')}</div>`;
}
function ideaForm(it) {
  openModal(it ? 'Modifier l’idée' : 'Nouvelle idée', `
<label>Titre *<input name="title" required maxlength="200" value="${esc(it ? it.title : '')}" placeholder="Ex. 24 h en tant que flic le plus détesté"></label>
<label>Description<textarea name="descr" rows="5" maxlength="4000" placeholder="Le concept, le format, les étapes…">${esc(it ? it.descr : '')}</textarea></label>
<div class="two"><label>Colonne<select name="status">${IST.map(([k, l]) => `<option value="${k}"${(it && it.status || 'idee') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label>Assignée à<select name="assignee">${memberOpts(it ? it.assignee : me)}</select></label></div>`,
    v => { const body = { title: v.title.trim().slice(0, 200), descr: v.descr || '', status: v.status, assignee: v.assignee || null, upd: new Date().toISOString() };
      if (it) return W('ideas', sb.from('ideas').update(body).eq('id', it.id));
      return W('ideas', sb.from('ideas').insert({ ...body, space: 'youtube' })); }, 'Enregistrer',
    it ? () => confirmDel('cette idée', () => W('ideas', sb.from('ideas').delete().eq('id', it.id))) : null);
}
// glisser-déposer des idées entre colonnes
let dragIdea = null;
main.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.task[data-idea]'); if (!c || view !== 'idees') return; dragIdea = c.dataset.idea; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'qg-idea:' + dragIdea) } catch {} setTimeout(() => c.classList.add('dragging')); });
main.addEventListener('dragend', () => { dragIdea = null; document.querySelectorAll('.task.dragging,.col.over').forEach(x => x.classList.remove('dragging', 'over')) });
main.addEventListener('dragover', e => { if (!dragIdea) return; const col = e.target.closest && e.target.closest('.col[data-ideacol]'); if (!col) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('.col.over').forEach(x => { if (x !== col) x.classList.remove('over') }); col.classList.add('over'); }, true);
main.addEventListener('drop', async e => { if (!dragIdea) return; const col = e.target.closest && e.target.closest('.col[data-ideacol]'); if (!col) return; e.preventDefault(); e.stopPropagation(); const id = dragIdea, to = col.dataset.ideacol; dragIdea = null; col.classList.remove('over'); const it = S.ideas.find(x => x.id === id); if (!it || it.status === to) return render(); const prev = it.status; it.status = to; render(); const { error } = await sb.from('ideas').update({ status: to, upd: new Date().toISOString() }).eq('id', id); if (error) { it.status = prev; render(); toast(errMsg(error)) } else toast(`« ${it.title} » → ${istLabel(to)}`); }, true);

// ---------- Assistant IA (Gemini) ----------
const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 2.5l1.9 4.9L18.8 9l-4.9 1.6L12 15.5l-1.9-4.9L5.2 9l4.9-1.6z"/></svg>';
function aiHtml(t) {
  t = String(t || '');
  const re = /```([\w+#.-]{0,20})[^\S\n]*\n?([\s\S]*?)(?:```|$)/g; let o = '', last = 0, m;
  const inl = s => esc(s).replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/`([^`\n]{1,300})`/g, '<code class="ic">$1</code>').replace(/\n/g, '<br>');
  while ((m = re.exec(t))) { if (m[0] === '') { re.lastIndex++; continue } o += inl(t.slice(last, m.index).replace(/\n$/, '')); const tag = (m[1] || '').toLowerCase(), code = m[2].replace(/\n$/, ''), lang = LANG[tag] || (tag ? 'txt' : guessLang(code)); o += `<div class="cb"><div class="cbh"><span>${esc(LNAME[lang] || 'Code')}</span><button type="button" class="cbcopy" data-copycode>Copier</button></div><pre><code>${hl(code, lang)}</code></pre></div>`; last = re.lastIndex; if (t[last] === '\n') last++; }
  return o + inl(t.slice(last));
}
const AI_TIPS = ['3 idées de vidéos courtes sur notre serveur GTA RP', 'Des titres qui donnent envie de cliquer', 'Un script d’intro de 15 secondes', 'Des idées de miniatures qui attirent l’œil'];
function vAssistant() {
  const head = `<div class="bar"><div><h2>Assistant IA</h2><p class="sub">${aiReady ? 'Propulsé par Gemini · ta conversation est privée, personne d’autre ne la voit.' : 'À configurer avant utilisation.'}</p></div>${aiReady && S.ai_chats.length ? '<button class="ghost" data-act="aiclear">Effacer la discussion</button>' : ''}</div>`;
  if (!aiReady) return head + `<div class="notice">L'assistant a besoin d'une clé Gemini (gratuite). Un admin de l'équipe doit l'ajouter une fois : crée une clé sur <b>Google AI Studio</b>, puis lance <b>supabase-update-0.8.sql</b> dans Supabase et colle la clé dedans (tout est expliqué dans le fichier). Ensuite, redémarre l'appli.</div>`;
  const msgs = S.ai_chats.slice().sort((a, b) => ts(a.at) - ts(b.at));
  const body = msgs.length ? msgs.map(m => m.role === 'user'
    ? `<div class="aim me"><div class="aib">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`
    : `<div class="aim"><span class="aiav">${SPARK}</span><div class="aiw"><div class="aib">${aiHtml(m.content)}</div><div class="airow"><button class="sm ghost" data-act="aisave" data-id="${esc(m.id)}">+ Enregistrer dans les idées</button></div></div></div>`).join('')
    : `<div class="aiempty"><span class="aiav big">${SPARK}</span><b>Demande-moi des idées de vidéos</b><span>Titres, scripts, miniatures, concepts… je suis là pour brainstormer avec toi.</span></div>`;
  const pending = aiBusy ? `<div class="aim"><span class="aiav">${SPARK}</span><div class="aiw"><div class="aib typing"><i></i><i></i><i></i></div></div></div>` : '';
  return head + `<div class="aiwrap"><section class="aicol"><div class="ailog" id="ailog">${body}${pending}</div>
<form class="aisend" id="aif"><textarea id="aitext" rows="1" maxlength="4000" placeholder="Demande une idée, un titre, un script…" aria-label="Message à l'assistant"${aiBusy ? ' disabled' : ''}></textarea><button class="pri" ${aiBusy ? 'disabled' : ''} aria-label="Envoyer">Envoyer</button></form></section>
<aside class="aiside"><section class="tile"><h3>Pour démarrer</h3><div class="aitips">${AI_TIPS.map(t => `<button class="chip" data-aitip="${esc(t)}">${esc(t)}</button>`).join('')}</div></section>
<section class="tile"><h3>Idées enregistrées<a href="#youtube-idees">Voir →</a></h3>${S.ideas.filter(i => spOf(i) === 'youtube').slice(0, 5).map(i => `<button class="hrowb" data-act="editidea" data-id="${esc(i.id)}"><span class="ht">${esc(i.title)}</span><span class="hm">${esc(istLabel(i.status))}</span></button>`).join('') || '<p class="empty">Aucune idée pour l’instant.</p>'}</section></aside></div>`;
}
async function askGemini(history) {
  const contents = history.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  const sys = { parts: [{ text: "Tu es l'assistant créatif d'une petite équipe qui fait des vidéos YouTube sur son serveur GTA RP (FiveM). Réponds en français, de façon concrète et concise, avec des idées exploitables. Propose des listes courtes quand c'est pertinent." }] };
  const body = JSON.stringify({ systemInstruction: sys, contents, generationConfig: { temperature: 0.9, maxOutputTokens: 2048 } });
  // Modèle choisi en premier, puis modèles de secours si surcharge. Évite de réessayer le même deux fois.
  const chain = [...new Set([aiModel, 'gemini-3.7-flash', 'gemini-3.6-flash'].filter(Boolean))];
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  let lastErr = 'Gemini indisponible.';
  for (const model of chain) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let r, j = null;
      try {
        r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(aiKey), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body
        });
      } catch { lastErr = 'Pas de connexion à Gemini.'; await sleep(800 * (attempt + 1)); continue; }
      try { j = await r.json() } catch {}
      if (r.ok) {
        const c = j && j.candidates && j.candidates[0];
        const txt = c && c.content && c.content.parts && c.content.parts.map(p => p.text || '').join('');
        if (txt) return txt.trim();
        if (c && c.finishReason === 'SAFETY') throw new Error('Gemini a bloqué cette réponse.');
        lastErr = 'Réponse vide de Gemini.'; break; // on tente le modèle suivant
      }
      lastErr = (j && j.error && j.error.message) || ('Gemini a répondu ' + r.status);
      if (r.status === 503 || r.status === 429 || r.status === 500) { await sleep(900 * (attempt + 1)); continue; } // surcharge : on réessaie
      if (r.status === 404) break; // modèle inexistant : on passe au suivant
      throw new Error(lastErr); // 400/403… : erreur permanente (clé, requête) — inutile de réessayer
    }
  }
  throw new Error('Gemini est surchargé (plusieurs tentatives et modèles essayés). Réessaie dans un moment.');
}
async function aiSend(text) {
  text = String(text || '').trim(); if (!text || aiBusy || !aiReady) return;
  const t = $('#aitext'); if (t) { t.value = ''; t.style.height = 'auto' }
  const hist = S.ai_chats.slice().sort((a, b) => ts(a.at) - ts(b.at)).map(m => ({ role: m.role, content: m.content }));
  const umsg = { id: 'tmp' + Math.random(), role: 'user', content: text, at: new Date().toISOString() };
  S.ai_chats.push(umsg); aiBusy = true; render(); aiScroll();
  sb.from('ai_chats').insert({ role: 'user', content: text }).select().single().then(({ data }) => { if (data) { umsg.id = data.id } }, () => {});
  try {
    const reply = await askGemini(hist.concat([{ role: 'user', content: text }]));
    const mmsg = { id: 'tmp' + Math.random(), role: 'model', content: reply, at: new Date().toISOString() };
    S.ai_chats.push(mmsg); aiBusy = false; render(); aiScroll();
    const { data } = await sb.from('ai_chats').insert({ role: 'model', content: reply }).select().single(); if (data && data.id) { mmsg.id = data.id; if (view === 'assistant') render() }
  } catch (e) { aiBusy = false; render(); toast('Assistant : ' + e.message); }
}
function aiScroll() { const l = $('#ailog'); if (l) l.scrollTop = l.scrollHeight; }
async function aiClear() {
  confirmDel('toute ta discussion avec l’assistant', async () => { const ids = S.ai_chats.map(m => m.id).filter(x => !String(x).startsWith('tmp')); S.ai_chats = []; render(); if (ids.length) await sb.from('ai_chats').delete().in('id', ids); return true });
}
async function aiSaveIdea(id) {
  const m = S.ai_chats.find(x => x.id === id); if (!m) return;
  const body = m.content.trim(); const title = body.split('\n')[0].replace(/^[#*\-\s]+/, '').slice(0, 120) || 'Idée de vidéo';
  if (await W('ideas', sb.from('ideas').insert({ title, descr: body.slice(0, 4000), space: 'youtube', status: 'idee' }))) toast('Ajouté aux idées');
}

// Boutons de fenêtre façon macOS
document.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => QG.win(b.dataset.win)));
$('#titlebar').addEventListener('dblclick', e => { if (!e.target.closest('.wctl,a,button,#updbox')) QG.win('max') });

boot().catch(e => { phase = cfg ? 'auth' : 'setup'; authMsg = errMsg(e); QG.bootDone(); render(true) });
}

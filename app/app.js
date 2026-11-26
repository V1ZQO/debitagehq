'use strict';
{
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const QG = window.qg || { rcCapture: async () => true, rcSession: async () => true, rcAttention: async () => true, rcInput: () => {}, onRcStop: () => {}, getAutoStart: async () => false, setAutoStart: async v => v, gofileUpload: async () => ({ ok: false }), onGofileProgress: () => null, bootProgress: () => {}, bootDone: () => {}, installUpdate: async () => false, checkUpdates: async () => false, updateStatus: async () => null, onUpdate: () => {}, win: () => {}, notify: async () => {}, openExternal: async u => window.open(u), isFocused: async () => document.hasFocus(), version: async () => 'dev', onNav: () => {} };

// ---------- État ----------
const CFG_KEY = 'qg.config';
let cfg = loadCfg(), sb = null, me = null, phase = 'boot', authTab = 'login', authMsg = '';
const S = { files: [], tasks: [], events: [], notes: [], messages: [], dms: [] };
let autoStart = true, online = new Set(), pres = null, dmReady = true, dmOpen = (() => { try { return localStorage.getItem('qg.dm') !== '0' } catch { return true } })(), dmWith = null, dmDraft = '';
let members = []; const names = {}; const thumbs = {};
const VIEWS = ['accueil', 'fichiers', 'taches', 'planning', 'notes', 'discussion', 'equipe', 'remote', 'parametres'];
const SPACES = { serveur: { label: 'Serveur GTA 6', sub: 'Développement' }, cheat: { label: 'Cheat', sub: 'Projet cheat' } };
let space = 'serveur', spaceReady = true;
const spOf = r => (r && r.space) || 'serveur';
const SP = t => S[t].filter(r => spOf(r) === space);   // données de l'espace affiché
const GLOBAL = ['equipe', 'remote', 'parametres'];
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
    folders: ['Builds', 'Sources', 'Offsets', 'Configs', 'Menu / UI', 'Outils', 'Docs', 'Autre'],
    ttags: ['Fonctionnalité', 'Menu / UI', 'Mise à jour', 'Bug', 'Test', 'Release', 'Autre'],
    ntags: ['Idée', 'Code', 'Recherche', 'Changelog', 'Réunion', 'Autre'],
    filesSub: "Builds, sources, offsets et configs partagés par l'équipe.",
    notesSub: 'Idées, recherches, changelogs et documentation technique.',
    notesHint: 'idée de fonctionnalité, recherche, changelog, architecture',
    taskEx: 'Ex. Nouvelle option du menu'
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
  dms: () => sb.from('dms').select('*').order('at', { ascending: false }).limit(1000)
};
async function loadTable(t) { const { data, error } = await QUERIES[t]();  if (t === 'dms') dmReady = !error; if (!error) { S[t] = data || []; if (t === 'files') refreshThumbs(); if (t === 'dms') markRead(); render() } }
async function loadMembers() { let { data, error } = await sb.from('members').select('user_id,name,joined_at,last_seen').order('name'); if (error) ({ data, error } = await sb.from('members').select('user_id,name,joined_at').order('name')); if (!error) { members = data || []; members.forEach(m => names[m.user_id] = m.name); render() } }
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
  pres.on('presence', { event: 'sync' }, () => { online = new Set(Object.keys(pres.presenceState())); renderDM() })
    .subscribe(async (s) => { if (s === 'SUBSCRIBED') { try { await pres.track({ at: Date.now() }) } catch {} } });
}
function touchSeen() { if (sb && me) sb.from('members').update({ last_seen: new Date().toISOString() }).eq('user_id', me).then(() => {}, () => {}) }
window.addEventListener('beforeunload', touchSeen);
async function onInsert(t, d) {
  if (t === 'dms') {
    if (!d || d.recipient !== me) return;
    const focused = await QG.isFocused();
    if (focused && dmOpen && dmWith === d.sender) return;
    if (!focused || !dmOpen || dmWith !== d.sender) QG.notify('Message privé de ' + nm(d.sender), String(d.body || ''), 'dm:' + d.sender);
    return;
  }
  if (!d || d.author === me || await QG.isFocused()) return;
  const sv = v => `${spOf(d)}-${v}`, tag = spOf(d) === 'cheat' ? '[Cheat] ' : '[Serveur] ';
  if (t === 'messages') QG.notify(tag + nm(d.author), String(d.body || ''), sv('discussion'));
  else if (t === 'files') QG.notify(tag + 'Nouveau fichier', `${nm(d.author)} a partagé « ${String(d.name || '')} »`, sv('fichiers'));
  else if (t === 'tasks' && d.assignee === me) QG.notify(tag + 'Nouvelle tâche pour toi', String(d.title || ''), sv('taches'));
  else if (t === 'events') QG.notify(tag + 'Nouveau rendez-vous', `${String(d.title || '')}, ${fmtDate(d.ev_date).w}`, sv('planning'));
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
  const td = today(); const up = SP('events').filter(e => String(e.ev_date || '') >= td); const mine = SP('tasks').filter(t => t.assignee === me && t.status !== 'done'); const cnt = k => SP('tasks').filter(t => t.status === k).length;
  const first = names[me] ? names[me].split(' ')[0] : ''; const none = t => `<p class="empty">${t}</p>`;
  const figs = [[SP('files').length, 'fichiers partagés', 'fichiers'], [cnt('todo'), 'tâches à faire', 'taches'], [cnt('doing'), 'tâches en cours', 'taches'], [up.length, 'rendez-vous à venir', 'planning'], [SP('notes').length, 'notes & docs', 'notes']];
  return `<h2>${first ? 'Salut ' + esc(first) : 'Accueil'}</h2><p class="sub">${esc(SPACES[space].label)} : ce qui se passe dans l'équipe.</p>
<div class="figs">${figs.map(([n, l, h]) => `<a href="${hrefOf(h)}"><b>${n}</b>${l}</a>`).join('')}</div>
<div class="grid2">
<section class="panel"><h3>Prochains rendez-vous <a href="${hrefOf('planning')}">Planning →</a></h3>${up.slice(0, 4).map(e => { const d = fmtDate(e.ev_date); return `<div class="li"><b class="d">${esc(d.d)} ${esc(d.m)}</b><span>${esc(e.title)}${e.ev_time ? ' · ' + esc(e.ev_time) : ''}</span></div>` }).join('') || none('Rien de prévu pour l’instant.')}</section>
<section class="panel"><h3>Mes tâches <a href="${hrefOf('taches')}">Tâches →</a></h3>${mine.slice(0, 5).map(t => `<div class="li"><b class="d">${t.status === 'doing' ? 'En cours' : 'À faire'}</b><span>${esc(t.title)}</span></div>`).join('') || none('Aucune tâche assignée à toi.')}</section>
<section class="panel"><h3>Derniers fichiers <a href="${hrefOf('fichiers')}">Fichiers →</a></h3>${SP('files').slice(0, 5).map(f => `<div class="li"><b class="d">${esc(String(f.folder || 'Autre').slice(0, 8))}</b><span>${esc(f.name)} <span class="sub">· ${esc(nm(f.author))}, ${esc(ago(f.at))}</span></span></div>`).join('') || none('Aucun fichier partagé.')}</section>
<section class="panel"><h3>Discussion <a href="${hrefOf('discussion')}">Ouvrir →</a></h3>${SP('messages').slice(0, 4).map(m => `<div class="li"><b class="d">${esc(nm(m.author).split(' ')[0])}</b><span>${esc(String(m.body || '').slice(0, 120))}</span></div>`).join('') || none('Pas encore de message.')}</section>
</div>`
}
function fileCard(f) {
  const th = f.path && thumbs[f.path]; const img = th && /^image\//.test(String(f.type || '')); const ext = (String(f.name || '').split('.').pop() || '').slice(0, 4).toUpperCase(); const id = esc(f.id);
  return `<div class="frow"><div class="ico">${img ? `<img src="${esc(th.url)}" alt="">` : (f.kind === 'link' ? 'LIEN' : f.kind === 'gofile' ? 'GOFILE' : esc(ext || '—'))}</div>
<div><b title="${esc(f.name)}">${esc(f.name)}</b><div class="c">${esc(nm(f.author))} · ${esc(ago(f.at))}</div></div>
<span class="c h1">${esc(f.folder || 'Autre')}</span><span class="c r">${f.size ? esc(size(f.size)) : ''}</span>
<div class="row end"><button class="sm" data-act="openfile" data-id="${id}">${f.kind === 'upload' ? 'Télécharger' : 'Ouvrir'}</button>${f.kind !== 'upload' ? `<button class="sm ghost" data-act="copy" data-id="${id}">Copier</button>` : ''}<button class="sm ghost" data-act="delfile" data-id="${id}" aria-label="Supprimer">Supprimer</button></div></div>`
}
function vFiles() {
  const q = fileQ.toLowerCase(); const list = SP('files').filter(f => (fileFolder === 'Tous' || f.folder === fileFolder) && (!q || String(f.name || '').toLowerCase().includes(q)));
  return `<div class="bar"><div><h2>Fichiers</h2><p class="sub">${esc(C().filesSub)}</p></div><div class="row"><select id="upFolder" aria-label="Dossier où envoyer" style="width:auto">${opts(C().folders, C().folders[0])}</select><label class="btn pri" for="upin" tabindex="0">Envoyer des fichiers</label><input type="file" id="upin" multiple hidden><label class="btn" for="goin" tabindex="0">Gros fichier (Gofile)</label><input type="file" id="goin" multiple hidden><button data-act="newlink">Ajouter un lien</button></div></div>
<p class="hint">Glisse tes fichiers ici ou utilise le bouton. Jusqu'à 50 Mo, les fichiers restent privés dans l'équipe. Au-delà, ils partent automatiquement sur Gofile (taille illimitée) : le lien n'est visible que dans l'appli, mais toute personne qui l'a peut télécharger, et Gofile supprime les fichiers restés plusieurs semaines sans téléchargement.</p>
${uploading.length ? `<p class="up">Envoi en cours : ${uploading.map(u => esc(u.name) + (u.via ? ' vers ' + u.via : '') + (u.pct != null ? ` (${u.pct} %)` : '')).join(', ')}</p>` : ''}
<div class="row"><input id="fq" type="search" placeholder="Rechercher un fichier" value="${esc(fileQ)}" aria-label="Rechercher un fichier"><div class="chips">${['Tous', ...C().folders].map(f => `<button class="chip${f === fileFolder ? ' on' : ''}" data-act="folder" data-id="${esc(f)}">${esc(f)}</button>`).join('')}</div></div>
${list.length ? `<div class="tbl">${list.map(fileCard).join('')}</div>` : `<p class="empty">${SP('files').length ? 'Aucun fichier ne correspond.' : 'Aucun fichier pour l’instant. Envoie le premier !'}</p>`}`
}
function card(t, i) {
  const id = esc(t.id);
  return `<article class="task${t.prio === 'Haute' ? ' hi' : ''}"><button class="tt" data-act="edittask" data-id="${id}">${esc(t.title || 'Sans titre')}</button>
${t.descr ? `<p>${esc(String(t.descr).slice(0, 140))}</p>` : ''}
<div class="meta"><span class="tag">${esc(t.tag || 'Autre')}</span>${t.prio === 'Haute' ? '<span class="hot">Urgent</span>' : ''}<span>${t.assignee ? esc(nm(t.assignee)) : 'Personne'}</span></div>
<div class="mv">${i > 0 ? `<button class="sm" data-act="mv" data-id="${id}" data-to="${ST[i - 1][0]}" aria-label="Revenir à ${ST[i - 1][1]}">←</button>` : ''}${i < 2 ? `<button class="sm" data-act="mv" data-id="${id}" data-to="${ST[i + 1][0]}">${i === 0 ? 'Commencer' : 'Terminer'} →</button>` : ''}</div></article>`
}
function vTasks() {
  const tl = taskMine ? SP('tasks').filter(t => t.assignee === me) : SP('tasks');
  return `<div class="bar"><div><h2>Tâches</h2><p class="sub">Qui fait quoi sur le projet.</p></div><div class="row"><label class="chk"><input type="checkbox" data-act="tmine"${taskMine ? ' checked' : ''}> Seulement les miennes</label><button class="pri" data-act="newtask">Nouvelle tâche</button></div></div>
<div class="kanban">${ST.map(([k, l], i) => { const col = tl.filter(t => (ST.some(s => s[0] === t.status) ? t.status : 'todo') === k); return `<section class="col c-${k}"><h3><i></i>${l} <span>${col.length}</span></h3>${col.map(t => card(t, i)).join('') || '<p class="empty">Rien ici.</p>'}</section>` }).join('')}</div>`
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
<textarea id="nbody" placeholder="Écris ici : ${esc(C().notesHint)}… (Ctrl+S pour enregistrer)">${esc(n.body || '')}</textarea>
<div class="row end"><button class="danger" data-act="delnote" data-id="${esc(n.id)}">Supprimer</button><button class="pri" data-act="savenote" data-id="${esc(n.id)}">Enregistrer</button></div>`
}
function vNotes() {
  const q = noteQ.toLowerCase(); const list = SP('notes').filter(n => !q || String(n.title || '').toLowerCase().includes(q) || String(n.body || '').toLowerCase().includes(q)); const n = SP('notes').find(x => x.id === noteSel);
  return `<div class="bar"><div><h2>Notes &amp; docs</h2><p class="sub">${esc(C().notesSub)}</p></div><button class="pri" data-act="newnote">Nouvelle note</button></div>
<div class="notes"><aside class="nl"><input id="nq" type="search" placeholder="Chercher dans les notes" value="${esc(noteQ)}" aria-label="Chercher dans les notes">
<ul>${list.map(x => `<li><button data-act="selnote" data-id="${esc(x.id)}" class="${x.id === noteSel ? 'on' : ''}"><b>${esc(x.title || 'Sans titre')}</b><span>${esc(x.tag || '')} · ${esc(ago(x.upd))}</span></button></li>`).join('') || '<li class="empty">Aucune note.</li>'}</ul></aside>
<div class="editor">${n ? editor(n) : `<p class="empty">Choisis une note ou crée-en une : ${esc(C().notesHint)}…</p>`}</div></div>`
}
function vChat() {
  const ms = [...SP('messages')].reverse();
  return `<div class="bar"><div><h2>Discussion</h2><p class="sub">Les 150 derniers messages de l'équipe.</p></div></div>
<div class="chat" id="chatlog">${ms.map(m => `<div class="msg${m.author === me ? ' me' : ''}"><div class="who">${esc(nm(m.author))} <span>${esc(ago(m.at))}</span>${m.author === me ? `<button class="x" data-act="delmsg" data-id="${esc(m.id)}" aria-label="Supprimer le message">×</button>` : ''}</div><div class="txt">${esc(m.body)}</div></div>`).join('') || '<p class="empty">Lance la conversation.</p>'}</div>
<form class="send" id="chatf"><textarea id="ctext" rows="2" maxlength="4000" placeholder="Écris un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)" aria-label="Message"></textarea><button class="pri">Envoyer</button></form>`
}
function vTeam() {
  return `<div class="bar"><div><h2>Équipe</h2><p class="sub">Les membres de l'équipe.</p></div></div>
<div class="grid2">
<section class="panel"><h3>Membres (${members.length})</h3>${members.map(m => `<div class="mem"><b>${avatar(m.user_id)}${esc(m.name)}${m.user_id === me ? ' (moi)' : ''}</b>${m.user_id !== me ? `<button class="sm" data-act="dmto" data-id="${esc(m.user_id)}">Message</button>` : ''}<span class="sub">depuis le ${esc(new Date(ts(m.joined_at)).toLocaleDateString('fr-FR'))}</span></div>`).join('')}</section>
</div>`
}
function vSettings() {
  return `<div class="bar"><div><h2>Paramètres</h2><p class="sub">Invitations, pseudo et réglages de l'application.</p></div><button class="ghost" data-act="logout">Se déconnecter</button></div>
<div class="grid2">
<section class="panel"><h3>Inviter un collègue</h3><p>Envoie-lui l'installateur de l'application et ce code d'invitation. Il le collera au premier lancement.</p>
<div class="code" id="invite">${esc(makeCode(cfg))}</div><div class="row" style="margin-top:10px"><button class="pri" data-act="copyinvite">Copier le code</button></div>
<p class="sub" style="margin-top:10px">Garde ce code dans l'équipe : n'importe qui qui l'a peut rejoindre DebitageHQ.</p></section>
<section class="panel"><h3>Mon pseudo</h3><form id="namef" class="row"><input id="myname" name="name" maxlength="40" value="${esc(names[me] || '')}" required style="flex:1"><button class="pri">Enregistrer</button></form></section>
<section class="panel"><h3>Application</h3><p class="sub">DebitageHQ version ${esc(version)}. Fermer la fenêtre range l'appli dans la zone de notification (en bas à droite). Pour la quitter, clic droit sur son icône puis « Quitter DebitageHQ ».</p>
<label class="chk" style="margin-top:10px"><input type="checkbox" data-act="autostart"${autoStart ? ' checked' : ''}> Lancer DebitageHQ au démarrage de Windows</label>
<div class="row" style="margin-top:10px"><button data-act="checkupd">Rechercher une mise à jour</button><button class="danger" data-act="resetcfg">Quitter cette équipe sur ce PC</button></div></section>
</div>`
}

const V = { accueil: vHome, fichiers: vFiles, taches: vTasks, planning: vPlan, notes: vNotes, discussion: vChat, equipe: vTeam, remote: vRemote, parametres: vSettings };
function render(fresh) {
  const main = $('#main'); const a = document.activeElement; const keep = {};
  if (!fresh) main.querySelectorAll('[data-dirty]').forEach(el => { if (el.id) keep[el.id] = el.value });
  const fid = !fresh && a && main.contains(a) && a.id ? a.id : null; let s0 = null, s1 = null; try { s0 = a.selectionStart; s1 = a.selectionEnd } catch {}
  const ch = $('#chatlog'); const atBot = !ch || ch.scrollHeight - ch.scrollTop - ch.clientHeight < 80;
  $('#shell').classList.toggle('gate-mode', phase !== 'app');
  if (phase === 'app') { const n = names[me] || ''; $('#mebox').innerHTML = `<div class="av">${esc((n[0] || '?').toUpperCase())}</div><span><b>${esc(n || 'Moi')}</b><small>Membre de l'équipe</small></span>`; const T = { accueil: 'Accueil', fichiers: 'Fichiers', taches: 'Tâches', planning: 'Planning', notes: 'Notes & docs', discussion: 'Discussion', equipe: 'Équipe' }; $('#pgtitle').textContent = view === 'equipe' ? 'Équipe' : view === 'remote' ? 'Contrôle à distance' : view === 'parametres' ? 'Paramètres' : `${SPACES[space].label}  ·  ${T[view] || ''}` }
  main.innerHTML = phase === 'setup' ? vSetup() : phase === 'auth' ? vAuth() : phase === 'app' ? ((!spaceReady && !GLOBAL.includes(view) ? `<div class="notice" style="margin-bottom:14px">Pour séparer Serveur GTA 6 et Cheat, lance le fichier <b>supabase-update-0.2.sql</b> dans Supabase &gt; SQL Editor, puis redémarre l'appli. En attendant, tu ne peux rien ajouter.</div>` : '') + V[view]()) : '<p class="empty">Connexion…</p>';
  for (const k in keep) { const el = document.getElementById(k); if (el) { try { el.value = keep[k]; el.dataset.dirty = 1 } catch {} } }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (s0 != null) el.setSelectionRange(s0, s1) } catch {} } }
  const c = $('#chatlog'); if (c && atBot) c.scrollTop = c.scrollHeight;
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
  parametres: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  remote: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 9 4 2.5-4 2.5z"/>',
  serveur: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  cheat: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9.5 12 2 2 3.5-4"/>'
};
const svg = p => `<svg viewBox="0 0 24 24">${p}</svg>`;
const LABELS = { accueil: 'Accueil', fichiers: 'Fichiers', taches: 'Tâches', planning: 'Planning', notes: 'Notes & docs', discussion: 'Discussion' };
function toggleGrp(id, save = true) { const g = document.querySelector(`.grp[data-g="${id}"]`); if (!g) return; const closed = g.classList.toggle('closed'); g.querySelector('.gh').setAttribute('aria-expanded', String(!closed)); if (save) try { localStorage.setItem('qg.grp.' + id, closed ? '0' : '1') } catch {} }
function buildSide() {
  const nav = $('#sidenav');
  nav.innerHTML = Object.entries(SPACES).map(([id, s]) => { let closed = false; try { closed = localStorage.getItem('qg.grp.' + id) === '0' } catch {}
    return `<div class="grp g-${id}${closed ? ' closed' : ''}" data-g="${id}"><button class="gh" data-grp="${id}" aria-expanded="${!closed}">${svg(ICONS[id])}<span><b>${s.label}</b><small>${s.sub}</small></span><svg class="chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>
<nav class="gl" aria-label="${s.label}">${Object.entries(LABELS).map(([v, l]) => `<a href="#${id}-${v}">${svg(ICONS[v])}<span>${l}</span></a>`).join('')}</nav></div>` }).join('')
    + `<div class="slabel">Général</div><nav aria-label="Général"><a href="#remote">${svg(ICONS.remote)}<span>Contrôle à distance</span></a><a href="#equipe">${svg(ICONS.equipe)}<span>Équipe</span></a><a href="#parametres">${svg(ICONS.parametres)}<span>Paramètres</span></a></nav>`;
  nav.addEventListener('click', e => { const b = e.target.closest('[data-grp]'); if (b) { e.preventDefault(); toggleGrp(b.dataset.grp) } });
}
buildSide();

// ---------- Messages privés (panneau de droite) ----------
const unreadFrom = id => S.dms.filter(d => d.recipient === me && d.sender === id && !d.read_at).length;
const unreadAll = () => S.dms.filter(d => d.recipient === me && !d.read_at).length;
const seenText = m => online.has(m.user_id) ? 'En ligne' : (m.last_seen ? 'Vu ' + ago(m.last_seen) : 'Hors ligne');
const avatar = (id, big) => `<span class="av${big ? ' big' : ''}${online.has(id) ? ' on' : ''}">${esc((nm(id)[0] || '?').toUpperCase())}</span>`;
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
  if (tg) { const n = phase === 'app' ? unreadAll() : 0; tg.hidden = phase !== 'app'; tg.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>Messages${n ? `<b class="badge">${n}</b>` : ''}`; tg.classList.toggle('on', show) }
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
  return `<button class="dmrow" data-dm="open" data-id="${esc(m.user_id)}">${avatar(m.user_id)}<span class="dmmid"><b>${esc(m.name)}</b><small>${last ? esc((last.sender === me ? 'Toi : ' : '') + String(last.body).slice(0, 40)) : esc(seenText(m))}</small></span>${u ? `<b class="badge">${u}</b>` : ''}</button>` }).join('') || '<p class="dmempty">Invite des membres pour discuter en privé.</p>'}</div>`;
    return;
  }
  const m = members.find(x => x.user_id === dmWith) || { user_id: dmWith, name: nm(dmWith) };
  const conv = S.dms.filter(d => (d.sender === dmWith && d.recipient === me) || (d.sender === me && d.recipient === dmWith)).slice().sort((x, y) => ts(x.at) - ts(y.at));
  box.innerHTML = `<div class="dmhead"><button class="x" data-dm="back" aria-label="Retour">‹</button>${avatar(dmWith, true)}<span class="dmmid"><b>${esc(m.name)}</b><small>${esc(seenText(m))}</small></span><button class="x" data-dm="close" aria-label="Fermer le panneau">×</button></div>
<div class="dmlog" id="dmlog">${conv.map(d => `<div class="dmmsg${d.sender === me ? ' me' : ''}"><div class="dmtxt">${esc(d.body)}</div><small>${esc(ago(d.at))}${d.sender === me && d.read_at ? ' · lu' : ''}</small></div>`).join('') || `<p class="dmempty">Commence la discussion avec ${esc(m.name)}.</p>`}</div>
<form class="dmsend" id="dmf"><textarea id="dmtext" rows="2" maxlength="4000" placeholder="Message à ${esc(m.name)}…" aria-label="Message privé"></textarea><button class="pri" aria-label="Envoyer">Envoyer</button></form>`;
  const ta = $('#dmtext'); ta.value = dmDraft; if (hadFocus) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
  const lg = $('#dmlog'); if (lg && atBot) lg.scrollTop = lg.scrollHeight;
}
function setDmOpen(v) { dmOpen = v; try { localStorage.setItem('qg.dm', v ? '1' : '0') } catch {} renderDM() }
function openDm(id) { dmWith = id; dmDraft = ''; setDmOpen(true); markRead(); renderDM(); const t = $('#dmtext'); if (t) t.focus() }
$('#dm').addEventListener('click', e => { const b = e.target.closest('[data-dm]'); if (!b) return; e.preventDefault(); const a = b.dataset.dm;
  if (a === 'close') setDmOpen(false); else if (a === 'back') { dmWith = null; renderDM() } else if (a === 'open') openDm(b.dataset.id) });
$('#dm').addEventListener('input', e => { if (e.target.id === 'dmtext') dmDraft = e.target.value });
$('#dm').addEventListener('keydown', e => { if (e.target.id === 'dmtext' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit() } });
$('#dm').addEventListener('submit', async e => {
  e.preventDefault(); const text = dmDraft.trim(); if (!text || !dmWith) return;
  const to = dmWith; dmDraft = ''; const t = $('#dmtext'); if (t) t.value = '';
  const { data, error } = await sb.from('dms').insert({ sender: me, recipient: to, body: text.slice(0, 4000) }).select().single();
  if (error) { dmDraft = text; toast(errMsg(error)); return renderDM() }
  if (data && !S.dms.some(d => d.id === data.id)) S.dms.unshift(data); renderDM();
});
$('#dmtoggle').addEventListener('click', () => setDmOpen(!dmOpen));
window.addEventListener('focus', () => { markRead(); renderDM() });
setInterval(() => { if (phase === 'app') renderDM() }, 60000);

function route() {
  const h = location.hash.slice(1); const m = /^(serveur|cheat)-([a-z]+)$/.exec(h);
  if (m && VIEWS.includes(m[2]) && !GLOBAL.includes(m[2])) { space = m[1]; view = m[2] } else if (GLOBAL.includes(h)) view = h; else view = 'accueil';
  if (fileFolder !== 'Tous' && !C().folders.includes(fileFolder)) fileFolder = 'Tous';
  $('#shell').classList.toggle('sp-cheat', space === 'cheat' && !GLOBAL.includes(view));
  document.querySelectorAll('.side nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + (GLOBAL.includes(view) ? view : space + '-' + view) ? 'page' : 'false'));
  const g = document.querySelector(`.grp[data-g="${space}"]`); if (g && !GLOBAL.includes(view) && g.classList.contains('closed')) toggleGrp(space, false);
  if (view === 'fichiers') refreshThumbs();
  render(true);
}

// ---------- Fenêtres de dialogue ----------
let mSubmit = null;
function openModal(title, html, onSubmit, ok, onDel) {
  $('#mtitle').textContent = title; $('#mbody').innerHTML = html; $('#mok').textContent = ok || 'Enregistrer';
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
<div class="two"><label>Assignée à<select name="assignee">${memberOpts(t ? t.assignee : me)}</select></label><label>Statut<select name="status">${ST.map(([k, l]) => `<option value="${k}"${(t && t.status || 'todo') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>`,
    v => { const body = { title: v.title.trim().slice(0, 140), descr: v.descr || '', tag: v.tag, prio: v.prio, assignee: v.assignee || null, status: v.status, upd: new Date().toISOString() };
      return t ? W('tasks', sb.from('tasks').update(body).eq('id', t.id)) : W('tasks', sb.from('tasks').insert({ ...body, space })) }, 'Enregistrer',
    t ? () => confirmDel('cette tâche', () => W('tasks', sb.from('tasks').delete().eq('id', t.id))) : null);
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
    const u = { name: f.name, pct: null }; uploading.push(u); render();
    const safe = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-120) || 'fichier';
    const path = `${crypto.randomUUID()}/${safe}`;
    const { error } = await sb.storage.from('files').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (error) toast(`Impossible d'envoyer ${f.name} : ${errMsg(error)}`);
    else if (!await W('files', sb.from('files').insert({ name: f.name.slice(0, 200), kind: 'upload', path, size: f.size, type: f.type || '', folder, space }))) await sb.storage.from('files').remove([path]);
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
    if (await W('files', sb.from('files').insert({ name: f.name.slice(0, 200), kind: 'gofile', url: r.url, size: f.size, type: f.type || '', folder, space: sp }))) toast(`${f.name} envoyé sur Gofile`);
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
    case 'folder': fileFolder = id; return render();
    case 'tmine': taskMine = el.checked; return render();
    case 'selnote': noteSel = id; return render(true);
    case 'edittask': return taskForm(find('tasks'));
    case 'newtask': return taskForm(null);
    case 'mv': return W('tasks', sb.from('tasks').update({ status: el.dataset.to, upd: new Date().toISOString() }).eq('id', id));
    case 'newev': return evForm(null);
    case 'editev': return evForm(find('events'));
    case 'go': { const e = find('events'); if (!e) return; const g = Array.isArray(e.going) ? e.going.filter(isId) : []; return W('events', sb.from('events').update({ going: g.includes(me) ? g.filter(x => x !== me) : [...g, me] }).eq('id', id)) }
    case 'newnote': { const { data, error } = await sb.from('notes').insert({ title: 'Sans titre', tag: C().ntags[0], body: '', space }).select().single(); if (error) return toast(errMsg(error)); S.notes.unshift(data); noteSel = data.id; noteQ = ''; render(true); const t = $('#ntitle'); if (t) { t.select(); t.focus() } return }
    case 'savenote': return saveNote(id);
    case 'delnote': return confirmDel('cette note', async () => { const ok = await W('notes', sb.from('notes').delete().eq('id', id)); if (ok) { noteSel = null; render(true) } return ok });
    case 'newlink': return linkForm();
    case 'openfile': { const f = find('files'); if (f) openFile(f); return }
    case 'copy': { const f = find('files'); const u = f && fileUrl(f); if (!u) return; try { await navigator.clipboard.writeText(u); toast('Lien copié') } catch { toast('Copie impossible') } return }
    case 'delfile': { const f = find('files'); if (!f) return; return confirmDel(`« ${f.name} »`, async () => { if (f.path && f.kind === 'upload') await sb.storage.from('files').remove([f.path]); return W('files', sb.from('files').delete().eq('id', id)) }) }
    case 'delmsg': return W('messages', sb.from('messages').delete().eq('id', id));
    case 'checkupd': if (updVersion) return QG.installUpdate(); { const ok = await QG.checkUpdates(); return toast(ok ? 'Recherche en cours. Si une nouvelle version existe, elle se télécharge en arrière-plan.' : 'Les mises à jour ne sont pas disponibles dans cette version de test.') }
    case 'dmto': return openDm(id);
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
  if (await W('notes', sb.from('notes').update(body).eq('id', id))) { const n = S.notes.find(x => x.id === id); if (n) Object.assign(n, body); toast('Note enregistrée'); render(true) }
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
      const ta = $('#ctext'); const text = ta.value.trim(); if (!text) return; ta.value = ''; delete ta.dataset.dirty;
      if (!await W('messages', sb.from('messages').insert({ body: text.slice(0, 4000), space }))) { const t2 = $('#ctext'); if (t2) { t2.value = text; t2.dataset.dirty = 1 } } return;
    }
    if (f.id === 'namef') { const n = String(v.name).trim().slice(0, 40); if (!n) return; if (await W('members', sb.from('members').update({ name: n }).eq('user_id', me))) { names[me] = n; toast('Pseudo mis à jour'); loadMembers() } }
  } finally { if (btn) btn.disabled = false }
}

const main = $('#main');
main.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.tagName !== 'INPUT') e.preventDefault(); act(b.dataset.act, b.dataset.id, b) });
main.addEventListener('submit', onForm);
main.addEventListener('input', e => { const t = e.target; if (t.id && t.type !== 'file' && t.type !== 'password') t.dataset.dirty = 1; if (t.id === 'fq') { fileQ = t.value; render() } if (t.id === 'nq') { noteQ = t.value; render() } });
main.addEventListener('change', e => { const t = e.target; if (t.id === 'upin' && t.files.length) { const l = [...t.files]; t.value = ''; uploadFiles(l) }
  if (t.id === 'goin' && t.files.length) { const l = [...t.files]; t.value = ''; const folder = ($('#upFolder') || {}).value || 'Autre'; (async () => { for (const f of l) await goUpload(f, folder) })() } if (t.id === 'ntag' || t.id === 'upFolder') t.dataset.dirty = 1 });
main.addEventListener('keydown', e => {
  const t = e.target;
  if (t.id === 'ctext' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); t.form.requestSubmit() }
  if ((t.id === 'nbody' || t.id === 'ntitle') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); const b = main.querySelector('[data-act=savenote]'); if (b) saveNote(b.dataset.id) }
  if (t.tagName === 'LABEL' && (t.htmlFor === 'upin' || t.htmlFor === 'goin') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#' + t.htmlFor).click() }
});
main.addEventListener('dragover', e => { if (phase !== 'app' || view !== 'fichiers') return; e.preventDefault(); main.classList.add('drop') });
main.addEventListener('dragleave', e => { if (e.target === main) main.classList.remove('drop') });
main.addEventListener('drop', e => { if (phase !== 'app' || view !== 'fichiers') return; e.preventDefault(); main.classList.remove('drop'); const l = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (l.length) uploadFiles(l) });
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
}
QG.onUpdate(showUpdate);
QG.updateStatus().then(v => { if (v) showUpdate(v) }).catch(() => {});

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

// Boutons de fenêtre façon macOS
document.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => QG.win(b.dataset.win)));
$('#titlebar').addEventListener('dblclick', e => { if (!e.target.closest('.wctl')) QG.win('max') });

boot().catch(e => { phase = cfg ? 'auth' : 'setup'; authMsg = errMsg(e); QG.bootDone(); render(true) });
}

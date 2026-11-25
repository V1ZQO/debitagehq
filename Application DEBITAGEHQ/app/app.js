'use strict';
{
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const QG = window.qg || { installUpdate: async () => false, checkUpdates: async () => false, updateStatus: async () => null, onUpdate: () => {}, win: () => {}, notify: async () => {}, openExternal: async u => window.open(u), isFocused: async () => document.hasFocus(), version: async () => 'dev', onNav: () => {} };

// ---------- État ----------
const CFG_KEY = 'qg.config';
let cfg = loadCfg(), sb = null, me = null, phase = 'boot', authTab = 'login', authMsg = '';
const S = { files: [], tasks: [], events: [], notes: [], messages: [] };
let members = []; const names = {}; const thumbs = {};
const VIEWS = ['accueil', 'fichiers', 'taches', 'planning', 'notes', 'discussion', 'equipe'];
let view = 'accueil', fileFolder = 'Tous', fileQ = '', noteQ = '', taskMine = false, noteSel = null, uploading = [], version = '';
const FOLDERS = ['Scripts', 'Maps', 'Visuels', 'Véhicules', 'Docs', 'Audio', 'Autre'];
const TTAGS = ['Script', 'Map', 'Interface', 'Lore', 'Économie', 'Bug', 'Autre'];
const NTAGS = ['Idée', 'Code', 'Lore', 'Règles', 'Réunion', 'Autre'];
const ST = [['todo', 'À faire'], ['doing', 'En cours'], ['done', 'Terminé']];
const MAX = 50 * 1048576;

function loadCfg() { try { const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); return c && c.u && c.k && c.s ? c : null } catch { return null } }
function saveCfg(c) { cfg = c; try { c ? localStorage.setItem(CFG_KEY, JSON.stringify(c)) : localStorage.removeItem(CFG_KEY) } catch {} }
const makeCode = c => 'QG1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ u: c.u, k: c.k, s: c.s }))));
function parseCode(t) {
  t = String(t || '').replace(/\s+/g, '');
  if (!t.startsWith('QG1.')) return null;
  try { const o = JSON.parse(decodeURIComponent(escape(atob(t.slice(4))))); return okCfg(o) ? o : null } catch { return null }
}
const okCfg = o => o && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(o.u) && typeof o.k === 'string' && o.k.length > 20 && typeof o.s === 'string' && o.s.length >= 6;

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
const fileUrl = f => f.kind === 'link' ? (typeof f.url === 'string' && f.url.startsWith('https://') ? f.url : null) : null;

// ---------- Connexion au serveur ----------
async function boot() {
  version = await QG.version().catch(() => '');
  if (!cfg) { phase = 'setup'; return render(true) }
  sb = window.supabase.createClient(cfg.u.replace(/\/$/, ''), cfg.k, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'qg.auth' } });
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { phase = cfg ? 'auth' : 'setup'; render(true) } });
  const { data } = await sb.auth.getSession();
  if (data && data.session) await enter(data.session.user); else { phase = 'auth'; render(true) }
}
async function enter(u) {
  me = u.id; phase = 'joining'; render(true);
  const { data: rows, error } = await sb.from('members').select('user_id,name').eq('user_id', me);
  if (error) { phase = 'auth'; authMsg = errMsg(error); return render(true) }
  if (!rows || !rows.length) {
    const nameGuess = (u.user_metadata && u.user_metadata.name) || String(u.email || '').split('@')[0];
    const { data: ok, error: e2 } = await sb.rpc('join_team', { code: cfg.s, display_name: nameGuess });
    if (e2 || !ok) { await sb.auth.signOut(); authMsg = e2 ? errMsg(e2) : "Le code secret de l'équipe est incorrect. Redemande un code d'invitation."; phase = 'auth'; return render(true) }
  }
  phase = 'app'; route();
  await Promise.all([loadMembers(), ...Object.keys(S).map(loadTable)]);
  subscribe();
}
const QUERIES = {
  files: () => sb.from('files').select('*').order('at', { ascending: false }).limit(500),
  tasks: () => sb.from('tasks').select('*').order('at', { ascending: false }).limit(500),
  events: () => sb.from('events').select('*').order('ev_date', { ascending: true }).limit(300),
  notes: () => sb.from('notes').select('*').order('upd', { ascending: false }).limit(500),
  messages: () => sb.from('messages').select('*').order('at', { ascending: false }).limit(150)
};
async function loadTable(t) { const { data, error } = await QUERIES[t](); if (!error) { S[t] = data || []; if (t === 'files') refreshThumbs(); render() } }
async function loadMembers() { const { data, error } = await sb.from('members').select('user_id,name,joined_at').order('name'); if (!error) { members = data || []; members.forEach(m => names[m.user_id] = m.name); render() } }
const timers = {};
function reload(t) { clearTimeout(timers[t]); timers[t] = setTimeout(() => t === 'members' ? loadMembers() : S[t] && loadTable(t), 250) }
let channel = null;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('qg-live').on('postgres_changes', { event: '*', schema: 'public' }, p => { reload(p.table); if (p.eventType === 'INSERT') onInsert(p.table, p.new) }).subscribe();
  setInterval(() => { Object.keys(S).forEach(reload); reload('members') }, 120000);
}
async function onInsert(t, d) {
  if (!d || d.author === me || await QG.isFocused()) return;
  if (t === 'messages') QG.notify(nm(d.author), String(d.body || ''), 'discussion');
  else if (t === 'files') QG.notify('Nouveau fichier', `${nm(d.author)} a partagé « ${String(d.name || '')} »`, 'fichiers');
  else if (t === 'tasks' && d.assignee === me) QG.notify('Nouvelle tâche pour toi', String(d.title || ''), 'taches');
  else if (t === 'events') QG.notify('Nouveau rendez-vous', `${String(d.title || '')}, ${fmtDate(d.ev_date).w}`, 'planning');
}
async function refreshThumbs() {
  const now = Date.now();
  const paths = S.files.filter(f => f.kind === 'upload' && f.path && /^image\//.test(String(f.type || '')) && !(thumbs[f.path] && thumbs[f.path].exp > now)).map(f => f.path).slice(0, 100);
  if (!paths.length) return;
  const { data } = await sb.storage.from('files').createSignedUrls(paths, 3600);
  (data || []).forEach(r => { if (r.signedUrl && r.path) thumbs[r.path] = { url: r.signedUrl, exp: now + 3300000 } });
  render();
}

// ---------- Écrans d'accès ----------
function vSetup() {
  return `<section class="gate"><div class="brand"><div class="logo">D</div>DebitageHQ</div><div class="box"><h2 style="font-size:18px">Rejoindre l'équipe</h2>
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
  return `<section class="gate"><div class="brand"><div class="logo">D</div>DebitageHQ</div><div class="box"><h2 style="font-size:18px">${login ? 'Connexion' : 'Créer mon compte'}</h2>
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
  const td = today(); const up = S.events.filter(e => String(e.ev_date || '') >= td); const mine = S.tasks.filter(t => t.assignee === me && t.status !== 'done'); const cnt = k => S.tasks.filter(t => t.status === k).length;
  const first = names[me] ? names[me].split(' ')[0] : ''; const none = t => `<p class="empty">${t}</p>`;
  const figs = [[S.files.length, 'fichiers partagés', 'fichiers'], [cnt('todo'), 'tâches à faire', 'taches'], [cnt('doing'), 'tâches en cours', 'taches'], [up.length, 'rendez-vous à venir', 'planning'], [S.notes.length, 'notes & docs', 'notes']];
  return `<h2>${first ? 'Salut ' + esc(first) : 'Accueil'}</h2><p class="sub">Ce qui se passe dans l'équipe.</p>
<div class="figs">${figs.map(([n, l, h]) => `<a href="#${h}"><b>${n}</b>${l}</a>`).join('')}</div>
<div class="grid2">
<section class="panel"><h3>Prochains rendez-vous <a href="#planning">Planning →</a></h3>${up.slice(0, 4).map(e => { const d = fmtDate(e.ev_date); return `<div class="li"><b class="d">${esc(d.d)} ${esc(d.m)}</b><span>${esc(e.title)}${e.ev_time ? ' · ' + esc(e.ev_time) : ''}</span></div>` }).join('') || none('Rien de prévu pour l’instant.')}</section>
<section class="panel"><h3>Mes tâches <a href="#taches">Tâches →</a></h3>${mine.slice(0, 5).map(t => `<div class="li"><b class="d">${t.status === 'doing' ? 'En cours' : 'À faire'}</b><span>${esc(t.title)}</span></div>`).join('') || none('Aucune tâche assignée à toi.')}</section>
<section class="panel"><h3>Derniers fichiers <a href="#fichiers">Fichiers →</a></h3>${S.files.slice(0, 5).map(f => `<div class="li"><b class="d">${esc(String(f.folder || 'Autre').slice(0, 8))}</b><span>${esc(f.name)} <span class="sub">· ${esc(nm(f.author))}, ${esc(ago(f.at))}</span></span></div>`).join('') || none('Aucun fichier partagé.')}</section>
<section class="panel"><h3>Discussion <a href="#discussion">Ouvrir →</a></h3>${S.messages.slice(0, 4).map(m => `<div class="li"><b class="d">${esc(nm(m.author).split(' ')[0])}</b><span>${esc(String(m.body || '').slice(0, 120))}</span></div>`).join('') || none('Pas encore de message.')}</section>
</div>`
}
function fileCard(f) {
  const th = f.path && thumbs[f.path]; const img = th && /^image\//.test(String(f.type || '')); const ext = (String(f.name || '').split('.').pop() || '').slice(0, 4).toUpperCase(); const id = esc(f.id);
  return `<div class="frow"><div class="ico">${img ? `<img src="${esc(th.url)}" alt="">` : (f.kind === 'link' ? 'LIEN' : esc(ext || '—'))}</div>
<div><b title="${esc(f.name)}">${esc(f.name)}</b><div class="c">${esc(nm(f.author))} · ${esc(ago(f.at))}</div></div>
<span class="c h1">${esc(f.folder || 'Autre')}</span><span class="c r">${f.size ? esc(size(f.size)) : ''}</span>
<div class="row end"><button class="sm" data-act="openfile" data-id="${id}">${f.kind === 'link' ? 'Ouvrir' : 'Télécharger'}</button>${f.kind === 'link' ? `<button class="sm ghost" data-act="copy" data-id="${id}">Copier</button>` : ''}<button class="sm ghost" data-act="delfile" data-id="${id}" aria-label="Supprimer">Supprimer</button></div></div>`
}
function vFiles() {
  const q = fileQ.toLowerCase(); const list = S.files.filter(f => (fileFolder === 'Tous' || f.folder === fileFolder) && (!q || String(f.name || '').toLowerCase().includes(q)));
  return `<div class="bar"><div><h2>Fichiers</h2><p class="sub">Scripts, maps, visuels et liens partagés par l'équipe.</p></div><div class="row"><select id="upFolder" aria-label="Dossier où envoyer" style="width:auto">${opts(FOLDERS, 'Scripts')}</select><label class="btn pri" for="upin" tabindex="0">Envoyer des fichiers</label><input type="file" id="upin" multiple hidden><button data-act="newlink">Ajouter un lien</button></div></div>
<p class="hint">Glisse tes fichiers ici ou utilise le bouton. Tous les formats sont acceptés (scripts, .zip, images, vidéos…) jusqu'à 50 Mo. Au-delà, ajoute un lien (Drive, Mega…).</p>
${uploading.length ? `<p class="up">Envoi en cours : ${uploading.map(esc).join(', ')}</p>` : ''}
<div class="row"><input id="fq" type="search" placeholder="Rechercher un fichier" value="${esc(fileQ)}" aria-label="Rechercher un fichier"><div class="chips">${['Tous', ...FOLDERS].map(f => `<button class="chip${f === fileFolder ? ' on' : ''}" data-act="folder" data-id="${esc(f)}">${esc(f)}</button>`).join('')}</div></div>
${list.length ? `<div class="tbl">${list.map(fileCard).join('')}</div>` : `<p class="empty">${S.files.length ? 'Aucun fichier ne correspond.' : 'Aucun fichier pour l’instant. Envoie le premier !'}</p>`}`
}
function card(t, i) {
  const id = esc(t.id);
  return `<article class="task${t.prio === 'Haute' ? ' hi' : ''}"><button class="tt" data-act="edittask" data-id="${id}">${esc(t.title || 'Sans titre')}</button>
${t.descr ? `<p>${esc(String(t.descr).slice(0, 140))}</p>` : ''}
<div class="meta"><span class="tag">${esc(t.tag || 'Autre')}</span>${t.prio === 'Haute' ? '<span class="hot">Urgent</span>' : ''}<span>${t.assignee ? esc(nm(t.assignee)) : 'Personne'}</span></div>
<div class="mv">${i > 0 ? `<button class="sm" data-act="mv" data-id="${id}" data-to="${ST[i - 1][0]}" aria-label="Revenir à ${ST[i - 1][1]}">←</button>` : ''}${i < 2 ? `<button class="sm" data-act="mv" data-id="${id}" data-to="${ST[i + 1][0]}">${i === 0 ? 'Commencer' : 'Terminer'} →</button>` : ''}</div></article>`
}
function vTasks() {
  const tl = taskMine ? S.tasks.filter(t => t.assignee === me) : S.tasks;
  return `<div class="bar"><div><h2>Tâches</h2><p class="sub">Qui fait quoi sur le serveur.</p></div><div class="row"><label class="chk"><input type="checkbox" data-act="tmine"${taskMine ? ' checked' : ''}> Seulement les miennes</label><button class="pri" data-act="newtask">Nouvelle tâche</button></div></div>
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
  const td = today(); const up = S.events.filter(e => String(e.ev_date || '') >= td), past = S.events.filter(e => String(e.ev_date || '') < td).reverse();
  return `<div class="bar"><div><h2>Planning</h2><p class="sub">Réunions, sessions de test et échéances.</p></div><button class="pri" data-act="newev">Nouvel événement</button></div>
${up.length ? `<div class="tbl">${up.map(evRow).join('')}</div>` : ''}<div>${up.length ? '' : '<p class="empty">Aucun rendez-vous prévu. Programme la prochaine réunion ou session de test.</p>'}</div>
${past.length ? `<details><summary>Événements passés (${past.length})</summary><div class="tbl past">${past.map(evRow).join('')}</div></details>` : ''}`
}
function editor(n) {
  return `<input id="ntitle" class="big" value="${esc(n.title || '')}" aria-label="Titre de la note" maxlength="140">
<div class="row"><select id="ntag" aria-label="Catégorie">${opts(NTAGS, n.tag)}</select><span class="sub">Modifiée ${esc(ago(n.upd))} par ${esc(nm(n.upd_by || n.author))}</span></div>
<textarea id="nbody" placeholder="Écris ici : idée de script, règle du serveur, morceau de lore, architecture… (Ctrl+S pour enregistrer)">${esc(n.body || '')}</textarea>
<div class="row end"><button class="danger" data-act="delnote" data-id="${esc(n.id)}">Supprimer</button><button class="pri" data-act="savenote" data-id="${esc(n.id)}">Enregistrer</button></div>`
}
function vNotes() {
  const q = noteQ.toLowerCase(); const list = S.notes.filter(n => !q || String(n.title || '').toLowerCase().includes(q) || String(n.body || '').toLowerCase().includes(q)); const n = S.notes.find(x => x.id === noteSel);
  return `<div class="bar"><div><h2>Notes &amp; docs</h2><p class="sub">Lore, règles, idées et documentation technique.</p></div><button class="pri" data-act="newnote">Nouvelle note</button></div>
<div class="notes"><aside class="nl"><input id="nq" type="search" placeholder="Chercher dans les notes" value="${esc(noteQ)}" aria-label="Chercher dans les notes">
<ul>${list.map(x => `<li><button data-act="selnote" data-id="${esc(x.id)}" class="${x.id === noteSel ? 'on' : ''}"><b>${esc(x.title || 'Sans titre')}</b><span>${esc(x.tag || '')} · ${esc(ago(x.upd))}</span></button></li>`).join('') || '<li class="empty">Aucune note.</li>'}</ul></aside>
<div class="editor">${n ? editor(n) : '<p class="empty">Choisis une note ou crée-en une : idées de scripts, règles du serveur, lore, architecture du code…</p>'}</div></div>`
}
function vChat() {
  const ms = [...S.messages].reverse();
  return `<div class="bar"><div><h2>Discussion</h2><p class="sub">Les 150 derniers messages de l'équipe.</p></div></div>
<div class="chat" id="chatlog">${ms.map(m => `<div class="msg${m.author === me ? ' me' : ''}"><div class="who">${esc(nm(m.author))} <span>${esc(ago(m.at))}</span>${m.author === me ? `<button class="x" data-act="delmsg" data-id="${esc(m.id)}" aria-label="Supprimer le message">×</button>` : ''}</div><div class="txt">${esc(m.body)}</div></div>`).join('') || '<p class="empty">Lance la conversation.</p>'}</div>
<form class="send" id="chatf"><textarea id="ctext" rows="2" maxlength="4000" placeholder="Écris un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)" aria-label="Message"></textarea><button class="pri">Envoyer</button></form>`
}
function vTeam() {
  return `<div class="bar"><div><h2>Équipe</h2><p class="sub">Membres, invitations et réglages.</p></div><button class="ghost" data-act="logout">Se déconnecter</button></div>
<div class="grid2">
<section class="panel"><h3>Membres (${members.length})</h3>${members.map(m => `<div class="mem"><b><span class="av">${esc((m.name || '?')[0].toUpperCase())}</span>${esc(m.name)}${m.user_id === me ? ' (moi)' : ''}</b><span class="sub">depuis le ${esc(new Date(ts(m.joined_at)).toLocaleDateString('fr-FR'))}</span></div>`).join('')}</section>
<section class="panel"><h3>Inviter un collègue</h3><p>Envoie-lui l'installateur de l'application et ce code d'invitation. Il le collera au premier lancement.</p>
<div class="code" id="invite">${esc(makeCode(cfg))}</div><div class="row" style="margin-top:10px"><button class="pri" data-act="copyinvite">Copier le code</button></div>
<p class="sub" style="margin-top:10px">Garde ce code dans l'équipe : n'importe qui qui l'a peut rejoindre DebitageHQ.</p></section>
<section class="panel"><h3>Mon pseudo</h3><form id="namef" class="row"><input id="myname" name="name" maxlength="40" value="${esc(names[me] || '')}" required style="flex:1"><button class="pri">Enregistrer</button></form></section>
<section class="panel"><h3>Application</h3><p class="sub">DebitageHQ version ${esc(version)}. Fermer la fenêtre range l'appli dans la zone de notification (en bas à droite). Pour la quitter, clic droit sur son icône puis « Quitter DebitageHQ ».</p>
<div class="row" style="margin-top:10px"><button data-act="checkupd">Rechercher une mise à jour</button><button class="danger" data-act="resetcfg">Quitter cette équipe sur ce PC</button></div></section>
</div>`
}

const V = { accueil: vHome, fichiers: vFiles, taches: vTasks, planning: vPlan, notes: vNotes, discussion: vChat, equipe: vTeam };
function render(fresh) {
  const main = $('#main'); const a = document.activeElement; const keep = {};
  if (!fresh) main.querySelectorAll('[data-dirty]').forEach(el => { if (el.id) keep[el.id] = el.value });
  const fid = !fresh && a && main.contains(a) && a.id ? a.id : null; let s0 = null, s1 = null; try { s0 = a.selectionStart; s1 = a.selectionEnd } catch {}
  const ch = $('#chatlog'); const atBot = !ch || ch.scrollHeight - ch.scrollTop - ch.clientHeight < 80;
  $('#shell').classList.toggle('gate-mode', phase !== 'app');
  if (phase === 'app') { const n = names[me] || ''; $('#mebox').innerHTML = `<div class="av">${esc((n[0] || '?').toUpperCase())}</div><span>${esc(n || 'Moi')}</span>` }
  main.innerHTML = phase === 'setup' ? vSetup() : phase === 'auth' ? vAuth() : phase === 'app' ? V[view]() : '<p class="empty">Connexion…</p>';
  for (const k in keep) { const el = document.getElementById(k); if (el) { try { el.value = keep[k]; el.dataset.dirty = 1 } catch {} } }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); try { if (s0 != null) el.setSelectionRange(s0, s1) } catch {} } }
  const c = $('#chatlog'); if (c && atBot) c.scrollTop = c.scrollHeight;
}
function route() {
  const h = location.hash.slice(1); view = VIEWS.includes(h) ? h : 'accueil';
  document.querySelectorAll('.side nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + view ? 'page' : 'false'));
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
<label>Titre *<input name="title" required maxlength="140" value="${esc(t ? t.title : '')}" placeholder="Ex. Script de permis de conduire"></label>
<label>Détails<textarea name="descr" rows="4" maxlength="4000">${esc(t ? t.descr : '')}</textarea></label>
<div class="two"><label>Catégorie<select name="tag">${opts(TTAGS, t ? t.tag : 'Script')}</select></label><label>Priorité<select name="prio">${opts(['Basse', 'Normale', 'Haute'], t && t.prio || 'Normale')}</select></label></div>
<div class="two"><label>Assignée à<select name="assignee">${memberOpts(t ? t.assignee : me)}</select></label><label>Statut<select name="status">${ST.map(([k, l]) => `<option value="${k}"${(t && t.status || 'todo') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>`,
    v => { const body = { title: v.title.trim().slice(0, 140), descr: v.descr || '', tag: v.tag, prio: v.prio, assignee: v.assignee || null, status: v.status, upd: new Date().toISOString() };
      return t ? W('tasks', sb.from('tasks').update(body).eq('id', t.id)) : W('tasks', sb.from('tasks').insert(body)) }, 'Enregistrer',
    t ? () => confirmDel('cette tâche', () => W('tasks', sb.from('tasks').delete().eq('id', t.id))) : null);
}
function evForm(e) {
  openModal(e ? 'Modifier l’événement' : 'Nouvel événement', `
<label>Titre *<input name="title" required maxlength="140" value="${esc(e ? e.title : '')}" placeholder="Ex. Réunion lore, test de l'économie"></label>
<div class="two"><label>Date *<input type="date" name="ev_date" required value="${esc(e ? e.ev_date : today())}"></label><label>Heure<input type="time" name="ev_time" value="${esc(e ? e.ev_time : '21:00')}"></label></div>
<label>Où<input name="place" maxlength="120" value="${esc(e ? e.place : '')}" placeholder="Discord vocal, en jeu…"></label>
<label>Détails<textarea name="descr" rows="4" maxlength="4000">${esc(e ? e.descr : '')}</textarea></label>`,
    v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v.ev_date)) { toast('Date invalide.'); return false } const body = { title: v.title.trim().slice(0, 140), ev_date: v.ev_date, ev_time: v.ev_time || '', place: v.place || '', descr: v.descr || '' };
      return e ? W('events', sb.from('events').update(body).eq('id', e.id)) : W('events', sb.from('events').insert({ ...body, going: [me] })) }, 'Enregistrer',
    e ? () => confirmDel('cet événement', () => W('events', sb.from('events').delete().eq('id', e.id))) : null);
}
function linkForm() {
  openModal('Ajouter un lien', `
<label>Nom *<input name="name" required maxlength="200" placeholder="Ex. Pack de véhicules v2"></label>
<label>Adresse (https://…) *<input type="url" name="url" required placeholder="https://drive.google.com/…"></label>
<label>Dossier<select name="folder">${opts(FOLDERS, 'Autre')}</select></label>`,
    v => { const u = v.url.trim(); if (!u.startsWith('https://')) { toast('Le lien doit commencer par https://'); return false }
      return W('files', sb.from('files').insert({ name: v.name.trim().slice(0, 200), kind: 'link', url: u.slice(0, 2000), folder: v.folder })) }, 'Ajouter');
}

// ---------- Fichiers ----------
async function uploadFiles(list) {
  const folder = ($('#upFolder') || {}).value || 'Autre';
  for (const f of list) {
    if (f.size > MAX) { toast(`${f.name} dépasse 50 Mo : ajoute-le plutôt en lien.`); continue }
    uploading.push(f.name); render();
    const safe = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-120) || 'fichier';
    const path = `${crypto.randomUUID()}/${safe}`;
    const { error } = await sb.storage.from('files').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (error) toast(`Impossible d'envoyer ${f.name} : ${errMsg(error)}`);
    else if (!await W('files', sb.from('files').insert({ name: f.name.slice(0, 200), kind: 'upload', path, size: f.size, type: f.type || '', folder }))) await sb.storage.from('files').remove([path]);
    uploading = uploading.filter(n => n !== f.name); render();
  }
}
async function openFile(f) {
  if (f.kind === 'link') { const u = fileUrl(f); if (u) QG.openExternal(u); return }
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
    case 'newnote': { const { data, error } = await sb.from('notes').insert({ title: 'Sans titre', tag: 'Idée', body: '' }).select().single(); if (error) return toast(errMsg(error)); S.notes.unshift(data); noteSel = data.id; noteQ = ''; render(true); const t = $('#ntitle'); if (t) { t.select(); t.focus() } return }
    case 'savenote': return saveNote(id);
    case 'delnote': return confirmDel('cette note', async () => { const ok = await W('notes', sb.from('notes').delete().eq('id', id)); if (ok) { noteSel = null; render(true) } return ok });
    case 'newlink': return linkForm();
    case 'openfile': { const f = find('files'); if (f) openFile(f); return }
    case 'copy': { const f = find('files'); const u = f && fileUrl(f); if (!u) return; try { await navigator.clipboard.writeText(u); toast('Lien copié') } catch { toast('Copie impossible') } return }
    case 'delfile': { const f = find('files'); if (!f) return; return confirmDel(`« ${f.name} »`, async () => { if (f.path) await sb.storage.from('files').remove([f.path]); return W('files', sb.from('files').delete().eq('id', id)) }) }
    case 'delmsg': return W('messages', sb.from('messages').delete().eq('id', id));
    case 'checkupd': if (updVersion) return QG.installUpdate(); { const ok = await QG.checkUpdates(); return toast(ok ? 'Recherche en cours. Si une nouvelle version existe, elle se télécharge en arrière-plan.' : 'Les mises à jour ne sont pas disponibles dans cette version de test.') }
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
      if (!await W('messages', sb.from('messages').insert({ body: text.slice(0, 4000) }))) { const t2 = $('#ctext'); if (t2) { t2.value = text; t2.dataset.dirty = 1 } } return;
    }
    if (f.id === 'namef') { const n = String(v.name).trim().slice(0, 40); if (!n) return; if (await W('members', sb.from('members').update({ name: n }).eq('user_id', me))) { names[me] = n; toast('Pseudo mis à jour'); loadMembers() } }
  } finally { if (btn) btn.disabled = false }
}

const main = $('#main');
main.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.tagName !== 'INPUT') e.preventDefault(); act(b.dataset.act, b.dataset.id, b) });
main.addEventListener('submit', onForm);
main.addEventListener('input', e => { const t = e.target; if (t.id && t.type !== 'file' && t.type !== 'password') t.dataset.dirty = 1; if (t.id === 'fq') { fileQ = t.value; render() } if (t.id === 'nq') { noteQ = t.value; render() } });
main.addEventListener('change', e => { const t = e.target; if (t.id === 'upin' && t.files.length) { const l = [...t.files]; t.value = ''; uploadFiles(l) } if (t.id === 'ntag' || t.id === 'upFolder') t.dataset.dirty = 1 });
main.addEventListener('keydown', e => {
  const t = e.target;
  if (t.id === 'ctext' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); t.form.requestSubmit() }
  if ((t.id === 'nbody' || t.id === 'ntitle') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); const b = main.querySelector('[data-act=savenote]'); if (b) saveNote(b.dataset.id) }
  if (t.tagName === 'LABEL' && t.htmlFor === 'upin' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('#upin').click() }
});
main.addEventListener('dragover', e => { if (phase !== 'app' || view !== 'fichiers') return; e.preventDefault(); main.classList.add('drop') });
main.addEventListener('dragleave', e => { if (e.target === main) main.classList.remove('drop') });
main.addEventListener('drop', e => { if (phase !== 'app' || view !== 'fichiers') return; e.preventDefault(); main.classList.remove('drop'); const l = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (l.length) uploadFiles(l) });
document.addEventListener('dragover', e => e.preventDefault()); document.addEventListener('drop', e => e.preventDefault());
window.addEventListener('hashchange', () => { if (phase === 'app') route() });
QG.onNav(v => { if (VIEWS.includes(v)) location.hash = v });
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

// Boutons de fenêtre façon macOS
document.querySelectorAll('[data-win]').forEach(b => b.addEventListener('click', () => QG.win(b.dataset.win)));
$('#titlebar').addEventListener('dblclick', e => { if (!e.target.closest('.lights')) QG.win('max') });
window.addEventListener('blur', () => document.body.classList.add('blur'));
window.addEventListener('focus', () => document.body.classList.remove('blur'));

boot().catch(e => { phase = cfg ? 'auth' : 'setup'; authMsg = errMsg(e); render(true) });
}

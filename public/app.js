/* Auto-École Béthel — application frontend (vanilla JS). */
'use strict';

const API = '/api';
let TOKEN = localStorage.getItem('ae_token') || '';
let USER = JSON.parse(localStorage.getItem('ae_user') || 'null');

/* ---------- Helpers réseau ---------- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { logout(); throw new Error('Session expirée'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

/* ---------- Utilitaires ---------- */
const $ = (s, r = document) => r.querySelector(s);
const fcfa = (n) => (Number(n) || 0).toLocaleString('fr-FR') + ' FCFA';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (s) => s ? String(s).replace('T', ' ').slice(0, 16) : '';
const todayISO = () => new Date().toISOString().slice(0, 10);

function toast(msg, ok = true) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${ok ? 'bg-emerald-600' : 'bg-red-600'}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

const BADGE = {
  en_cours: 'bg-blue-100 text-blue-700', examen_reussi: 'bg-emerald-100 text-emerald-700',
  examen_echoue: 'bg-red-100 text-red-700', suspendu: 'bg-slate-200 text-slate-600',
  paye: 'bg-emerald-100 text-emerald-700', en_attente: 'bg-orange-100 text-orange-700',
  echoue: 'bg-red-100 text-red-700', annule: 'bg-slate-200 text-slate-600',
  reussi: 'bg-emerald-100 text-emerald-700', prevue: 'bg-blue-100 text-blue-700',
  effectuee: 'bg-emerald-100 text-emerald-700', annulee: 'bg-slate-200 text-slate-600',
  present: 'bg-emerald-100 text-emerald-700', absent: 'bg-red-100 text-red-700',
  ok: 'bg-emerald-100 text-emerald-700', revision_due: 'bg-orange-100 text-orange-700',
  controle_technique_du: 'bg-orange-100 text-orange-700', hors_service: 'bg-red-100 text-red-700',
};
const LABEL = {
  en_cours: 'En cours', examen_reussi: 'Examen réussi', examen_echoue: 'Examen échoué', suspendu: 'Suspendu',
  paye: 'Payé', en_attente: 'En attente', echoue: 'Échoué', annule: 'Annulé',
  reussi: 'Réussi', prevue: 'Prévue', effectuee: 'Effectuée', annulee: 'Annulée',
  present: 'Présent', absent: 'Absent', ok: 'OK', revision_due: 'Révision due',
  controle_technique_du: 'Contrôle tech. dû', hors_service: 'Hors service',
  theorie: 'Théorie', conduite_circulation: 'Conduite — circulation',
  conduite_route: 'Conduite — route', conduite_autoroute: 'Conduite — autoroute',
  inscription: 'Inscription', lecon: 'Leçon', examen: 'Examen', pack: 'Pack',
  especes: 'Espèces', airtel: 'Airtel Money', moov: 'Moov Money', ebilling: 'E-Billing',
  code: 'Code', permis_conduire: 'Permis de conduire',
};
const badge = (v) => `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[v] || 'bg-slate-100 text-slate-600'}">${LABEL[v] || v || '—'}</span>`;

/* ---------- Modale ---------- */
function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modal-backdrop').classList.remove('hidden');
}
function closeModal() { $('#modal-backdrop').classList.add('hidden'); $('#modal').innerHTML = ''; }
$('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });

// Construit un formulaire simple à partir d'une liste de champs.
function formModal(titre, champs, valeurs, onSubmit) {
  const field = (f) => {
    const v = valeurs?.[f.name] ?? f.default ?? '';
    if (f.type === 'select') {
      return `<label class="block text-sm font-medium mb-1">${f.label}</label>
        <select name="${f.name}" class="w-full border rounded-lg px-3 py-2 mb-3">
          ${f.options.map((o) => `<option value="${o.v}" ${o.v == v ? 'selected' : ''}>${o.l}</option>`).join('')}
        </select>`;
    }
    if (f.type === 'textarea') {
      return `<label class="block text-sm font-medium mb-1">${f.label}</label>
        <textarea name="${f.name}" rows="2" class="w-full border rounded-lg px-3 py-2 mb-3">${esc(v)}</textarea>`;
    }
    return `<label class="block text-sm font-medium mb-1">${f.label}${f.required ? ' *' : ''}</label>
      <input name="${f.name}" type="${f.type || 'text'}" ${f.required ? 'required' : ''} value="${esc(v)}"
        class="w-full border rounded-lg px-3 py-2 mb-3" />`;
  };
  openModal(`
    <div class="p-5 border-b flex items-center justify-between">
      <h3 class="font-bold text-lg text-marine-800">${titre}</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-xl">✕</button>
    </div>
    <form id="modal-form" class="p-5">
      ${champs.map(field).join('')}
      <div class="flex gap-2 justify-end mt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg border">Annuler</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-brand text-white font-semibold">Enregistrer</button>
      </div>
    </form>`);
  $('#modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try { await onSubmit(fd); closeModal(); } catch (err) { toast(err.message, false); }
  });
}

/* ---------- Navigation ---------- */
const SECTIONS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊', roles: ['admin', 'moniteur'] },
  { id: 'eleves', label: 'Élèves', icon: '🎓', roles: ['admin', 'moniteur'] },
  { id: 'moniteurs', label: 'Moniteurs', icon: '👨‍🏫', roles: ['admin'] },
  { id: 'vehicules', label: 'Véhicules', icon: '🚙', roles: ['admin'] },
  { id: 'lecons', label: 'Leçons', icon: '📅', roles: ['admin', 'moniteur'] },
  { id: 'paiements', label: 'Paiements', icon: '💳', roles: ['admin'] },
  { id: 'examens', label: 'Examens', icon: '🏁', roles: ['admin', 'moniteur'] },
];

function buildNav() {
  const nav = $('#nav');
  nav.innerHTML = SECTIONS.filter((s) => s.roles.includes(USER.role))
    .map((s) => `<a href="#${s.id}" data-sec="${s.id}"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 cursor-pointer">
        <span>${s.icon}</span><span>${s.label}</span></a>`).join('');
}

function go(secId) {
  const sec = SECTIONS.find((s) => s.id === secId) || SECTIONS[0];
  if (!sec.roles.includes(USER.role)) return;
  $('#page-title').textContent = sec.label;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('nav-active', a.dataset.sec === sec.id));
  $('#header-actions').innerHTML = '';
  $('#view').innerHTML = '<div class="text-slate-400 py-10 text-center">Chargement…</div>';
  $('#sidebar').classList.add('-translate-x-full'); // referme le menu mobile
  (RENDER[sec.id] || RENDER.dashboard)();
}
window.addEventListener('hashchange', () => go(location.hash.slice(1)));

/* ---------- Composants tableaux ---------- */
function card(title, value, sub, color = 'brand') {
  const c = { brand: 'text-brand', emerald: 'text-emerald-600', orange: 'text-orange-500', red: 'text-red-600' }[color];
  return `<div class="bg-white rounded-xl shadow-sm p-5">
    <div class="text-sm text-slate-500">${title}</div>
    <div class="text-2xl font-bold ${c} mt-1">${value}</div>
    ${sub ? `<div class="text-xs text-slate-400 mt-1">${sub}</div>` : ''}
  </div>`;
}
const btnPrimary = (txt, onclick) => `<button onclick="${onclick}" class="bg-brand hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">${txt}</button>`;

function tableWrap(head, rows) {
  return `<div class="bg-white rounded-xl shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 text-slate-500 text-left">
        <tr>${head.map((h) => `<th class="px-4 py-3 font-medium whitespace-nowrap">${h}</th>`).join('')}</tr>
      </thead>
      <tbody class="divide-y">${rows || `<tr><td class="px-4 py-6 text-slate-400" colspan="${head.length}">Aucune donnée.</td></tr>`}</tbody>
    </table></div></div>`;
}

/* ---------- Vues ---------- */
const RENDER = {};

RENDER.dashboard = async () => {
  const d = await api('/dashboard');
  const maxRev = Math.max(1, ...d.revenus.map((r) => r.total));
  const bars = d.revenus.map((r) => `
    <div class="flex flex-col items-center gap-1 flex-1">
      <div class="text-xs text-slate-400">${(r.total / 1000).toFixed(0)}k</div>
      <div class="w-full bg-brand/80 rounded-t" style="height:${Math.max(6, (r.total / maxRev) * 120)}px"></div>
      <div class="text-xs text-slate-500">${r.mois.slice(5)}</div>
    </div>`).join('');
  const alerts = d.alertesVehicules.map((v) =>
    `<li class="flex justify-between py-1"><span>${esc(v.immatriculation)}</span>${badge(v.statut_maintenance)}</li>`).join('') || '<li class="text-slate-400 py-1">Aucune alerte</li>';
  const lj = d.leconsJour.map((l) => `<tr>
      <td class="px-4 py-2">${fmtDate(l.date_heure).slice(11)}</td>
      <td class="px-4 py-2">${esc(l.eleve_prenom)} ${esc(l.eleve_nom)}</td>
      <td class="px-4 py-2">${esc(l.moniteur_prenom || '—')}</td>
      <td class="px-4 py-2">${LABEL[l.type_lecon] || l.type_lecon}</td></tr>`).join('');

  $('#view').innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${card("Chiffre d'affaires (mois)", fcfa(d.caMois), null, 'emerald')}
      ${card('Élèves actifs', d.elevesActifs, `${d.elevesTotal} au total`, 'brand')}
      ${card('Leçons à venir', d.leconsPrevues, null, 'orange')}
      ${card('Taux de réussite', d.tauxReussite + '%', `${d.examens.reussis}/${d.examens.total} examens`, 'emerald')}
    </div>
    <div class="grid lg:grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-5 lg:col-span-2">
        <div class="font-semibold mb-4 text-marine-800">Revenus (6 derniers mois)</div>
        <div class="flex items-end gap-3 h-40">${bars || '<div class="text-slate-400">Aucun revenu</div>'}</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5">
        <div class="font-semibold mb-3 text-marine-800">Maintenance véhicules</div>
        <ul class="text-sm">${alerts}</ul>
        <div class="mt-4 text-sm text-slate-500">Paiements en attente :
          <span class="font-semibold text-orange-500">${fcfa(d.paiementsEnAttente.t)}</span> (${d.paiementsEnAttente.c})</div>
      </div>
    </div>
    <div class="grid lg:grid-cols-2 gap-4">
      <div>
        <div class="font-semibold mb-2 text-marine-800">Leçons du jour</div>
        ${tableWrap(['Heure', 'Élève', 'Moniteur', 'Type'], lj)}
      </div>
      <div>
        <div class="font-semibold mb-2 text-marine-800">Réussite par moniteur</div>
        ${tableWrap(['Moniteur', 'Examens', 'Réussis', 'Taux'],
          d.reussiteParMoniteur.map((m) => `<tr>
            <td class="px-4 py-2">${esc(m.prenom)} ${esc(m.nom)}</td>
            <td class="px-4 py-2">${m.total}</td>
            <td class="px-4 py-2">${m.reussis}</td>
            <td class="px-4 py-2 font-semibold">${Math.round((m.reussis / m.total) * 100)}%</td></tr>`).join(''))}
      </div>
    </div>`;
};

RENDER.eleves = async () => {
  const admin = USER.role === 'admin';
  if (admin) $('#header-actions').innerHTML = btnPrimary('+ Nouvel élève', 'formEleve()');
  const list = await api('/eleves');
  const rows = list.map((e) => `<tr class="hover:bg-slate-50">
    <td class="px-4 py-2 font-medium">${esc(e.nom)} ${esc(e.prenom)}</td>
    <td class="px-4 py-2">${esc(e.telephone)}</td>
    <td class="px-4 py-2">${esc(e.id_identite)}</td>
    <td class="px-4 py-2">${badge(e.statut)}</td>
    <td class="px-4 py-2 text-right whitespace-nowrap">
      <button onclick="voirEleve(${e.id})" class="text-brand hover:underline">Dossier</button>
      ${admin ? `· <button onclick="formEleve(${e.id})" class="text-slate-500 hover:underline">Modifier</button>` : ''}
    </td></tr>`).join('');
  $('#view').innerHTML = tableWrap(['Nom', 'Téléphone', 'Identité', 'Statut', ''], rows);
};

window.formEleve = async (id) => {
  const val = id ? await api('/eleves/' + id) : {};
  formModal(id ? 'Modifier l’élève' : 'Nouvel élève', [
    { name: 'nom', label: 'Nom', required: true },
    { name: 'prenom', label: 'Prénom', required: true },
    { name: 'telephone', label: 'Téléphone (WhatsApp)', type: 'tel' },
    { name: 'adresse', label: 'Adresse' },
    { name: 'id_identite', label: 'N° d’identité (CNI)' },
    { name: 'statut', label: 'Statut', type: 'select', options: [
      { v: 'en_cours', l: 'En cours' }, { v: 'examen_reussi', l: 'Examen réussi' },
      { v: 'examen_echoue', l: 'Examen échoué' }, { v: 'suspendu', l: 'Suspendu' }] },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ], val, async (fd) => {
    await api(id ? '/eleves/' + id : '/eleves', { method: id ? 'PUT' : 'POST', body: fd });
    toast('Élève enregistré'); go('eleves');
  });
};

window.voirEleve = async (id) => {
  const e = await api('/eleves/' + id);
  const lecons = e.lecons.map((l) => `<tr><td class="px-3 py-1.5">${fmtDate(l.date_heure)}</td>
    <td class="px-3 py-1.5">${LABEL[l.type_lecon] || l.type_lecon}</td>
    <td class="px-3 py-1.5">${esc(l.moniteur_prenom || '—')}</td><td class="px-3 py-1.5">${badge(l.status)}</td></tr>`).join('');
  const paie = e.paiements.map((p) => `<tr><td class="px-3 py-1.5">${fmtDate(p.date_paiement)}</td>
    <td class="px-3 py-1.5">${LABEL[p.type]}</td><td class="px-3 py-1.5">${fcfa(p.montant)}</td>
    <td class="px-3 py-1.5">${badge(p.statut)}</td></tr>`).join('');
  openModal(`
    <div class="p-5 border-b flex items-center justify-between">
      <div><h3 class="font-bold text-lg text-marine-800">${esc(e.prenom)} ${esc(e.nom)}</h3>
        <div class="text-sm text-slate-500">${esc(e.telephone)} · ${esc(e.adresse || '')}</div></div>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-xl">✕</button>
    </div>
    <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
      <div class="flex flex-wrap gap-2 items-center">
        ${badge(e.statut)}
        <span class="text-sm text-slate-500">Total payé : <b>${fcfa(e.totalPaye)}</b></span>
        <a href="${e.whatsapp}" target="_blank" class="ml-auto text-sm bg-emerald-500 text-white px-3 py-1.5 rounded-lg">💬 WhatsApp</a>
      </div>
      <div><div class="font-semibold text-sm mb-1">Leçons (${e.lecons.length})</div>
        <table class="w-full text-sm border rounded">${lecons || '<tr><td class="px-3 py-2 text-slate-400">Aucune</td></tr>'}</table></div>
      <div><div class="font-semibold text-sm mb-1">Paiements (${e.paiements.length})</div>
        <table class="w-full text-sm border rounded">${paie || '<tr><td class="px-3 py-2 text-slate-400">Aucun</td></tr>'}</table></div>
      <div><div class="font-semibold text-sm mb-1">Examens (${e.examens.length})</div>
        <table class="w-full text-sm border rounded">${e.examens.map((x) => `<tr>
          <td class="px-3 py-1.5">${fmtDate(x.date_examen)}</td><td class="px-3 py-1.5">${LABEL[x.type_examen]}</td>
          <td class="px-3 py-1.5">${badge(x.resultat)}</td></tr>`).join('') || '<tr><td class="px-3 py-2 text-slate-400">Aucun</td></tr>'}</table></div>
    </div>`);
};

RENDER.moniteurs = async () => {
  $('#header-actions').innerHTML = btnPrimary('+ Nouveau moniteur', 'formMoniteur()');
  const list = await api('/moniteurs');
  const rows = list.map((m) => `<tr class="hover:bg-slate-50">
    <td class="px-4 py-2 font-medium">${esc(m.nom)} ${esc(m.prenom)}</td>
    <td class="px-4 py-2">${esc(m.licence_num)}</td>
    <td class="px-4 py-2">${esc(m.telephone)}</td>
    <td class="px-4 py-2">${m.nb_lecons} leçons</td>
    <td class="px-4 py-2">${m.note_moyenne ? m.note_moyenne + '/20' : '—'}</td>
    <td class="px-4 py-2 text-right"><button onclick="formMoniteur(${m.id})" class="text-brand hover:underline">Modifier</button></td>
  </tr>`).join('');
  $('#view').innerHTML = tableWrap(['Nom', 'Licence', 'Téléphone', 'Activité', 'Note moy.', ''], rows);
};

window.formMoniteur = async (id) => {
  const val = id ? await api('/moniteurs/' + id) : {};
  formModal(id ? 'Modifier le moniteur' : 'Nouveau moniteur', [
    { name: 'nom', label: 'Nom', required: true },
    { name: 'prenom', label: 'Prénom', required: true },
    { name: 'licence_num', label: 'N° de licence' },
    { name: 'certificat', label: 'Certificat / agrément' },
    { name: 'telephone', label: 'Téléphone', type: 'tel' },
    { name: 'disponibilites_json', label: 'Disponibilités (JSON)', type: 'textarea', default: '{}' },
  ], val, async (fd) => {
    await api(id ? '/moniteurs/' + id : '/moniteurs', { method: id ? 'PUT' : 'POST', body: fd });
    toast('Moniteur enregistré'); go('moniteurs');
  });
};

RENDER.vehicules = async () => {
  $('#header-actions').innerHTML = btnPrimary('+ Nouveau véhicule', 'formVehicule()');
  const list = await api('/vehicules');
  const rows = list.map((v) => `<tr class="hover:bg-slate-50">
    <td class="px-4 py-2 font-medium">${esc(v.immatriculation)}</td>
    <td class="px-4 py-2">${esc(v.marque)} ${esc(v.modele)}</td>
    <td class="px-4 py-2">${badge(v.statut_maintenance)}</td>
    <td class="px-4 py-2">${esc(v.date_prochaine_revision || '—')}</td>
    <td class="px-4 py-2">${v.moniteur_nom ? esc(v.moniteur_prenom + ' ' + v.moniteur_nom) : '—'}</td>
    <td class="px-4 py-2 text-right"><button onclick="formVehicule(${v.id})" class="text-brand hover:underline">Modifier</button></td>
  </tr>`).join('');
  $('#view').innerHTML = tableWrap(['Immat.', 'Véhicule', 'Maintenance', 'Prochaine révision', 'Moniteur', ''], rows);
};

window.formVehicule = async (id) => {
  const val = id ? await api('/vehicules/' + id) : {};
  const moniteurs = await api('/moniteurs');
  formModal(id ? 'Modifier le véhicule' : 'Nouveau véhicule', [
    { name: 'immatriculation', label: 'Immatriculation', required: true },
    { name: 'marque', label: 'Marque' },
    { name: 'modele', label: 'Modèle' },
    { name: 'statut_maintenance', label: 'État maintenance', type: 'select', options: [
      { v: 'ok', l: 'OK' }, { v: 'revision_due', l: 'Révision due' },
      { v: 'controle_technique_du', l: 'Contrôle technique dû' }, { v: 'hors_service', l: 'Hors service' }] },
    { name: 'date_prochaine_revision', label: 'Prochaine révision', type: 'date' },
    { name: 'moniteur_id', label: 'Moniteur affecté', type: 'select', options: [
      { v: '', l: '— Aucun —' }, ...moniteurs.map((m) => ({ v: m.id, l: `${m.prenom} ${m.nom}` }))] },
  ], val, async (fd) => {
    await api(id ? '/vehicules/' + id : '/vehicules', { method: id ? 'PUT' : 'POST', body: fd });
    toast('Véhicule enregistré'); go('vehicules');
  });
};

RENDER.lecons = async () => {
  $('#header-actions').innerHTML = btnPrimary('+ Réserver une leçon', 'formLecon()');
  const list = await api('/lecons');
  const rows = list.map((l) => `<tr class="hover:bg-slate-50">
    <td class="px-4 py-2 whitespace-nowrap">${fmtDate(l.date_heure)}</td>
    <td class="px-4 py-2">${esc(l.eleve_prenom)} ${esc(l.eleve_nom)}</td>
    <td class="px-4 py-2">${LABEL[l.type_lecon] || l.type_lecon}</td>
    <td class="px-4 py-2">${esc(l.moniteur_prenom || '—')}</td>
    <td class="px-4 py-2">${esc(l.immatriculation || '—')}</td>
    <td class="px-4 py-2">${badge(l.presence)}</td>
    <td class="px-4 py-2">${badge(l.status)}</td>
    <td class="px-4 py-2 text-right"><button onclick="formLecon(${l.id})" class="text-brand hover:underline">Suivi</button></td>
  </tr>`).join('');
  $('#view').innerHTML = tableWrap(['Date/heure', 'Élève', 'Type', 'Moniteur', 'Véhicule', 'Présence', 'Statut', ''], rows);
};

window.formLecon = async (id) => {
  const [eleves, moniteurs, vehicules] = await Promise.all([api('/eleves'), api('/moniteurs'), api('/vehicules')]);
  const val = id ? (await api('/lecons?')).find?.((x) => x.id === id) : null;
  const cur = id ? await api('/lecons').then((a) => a.find((x) => x.id === id)) : {};
  formModal(id ? 'Suivi de la leçon' : 'Réserver une leçon', [
    { name: 'eleve_id', label: 'Élève', type: 'select', required: true,
      options: eleves.map((e) => ({ v: e.id, l: `${e.prenom} ${e.nom}` })) },
    { name: 'moniteur_id', label: 'Moniteur', type: 'select',
      options: [{ v: '', l: '—' }, ...moniteurs.map((m) => ({ v: m.id, l: `${m.prenom} ${m.nom}` }))] },
    { name: 'vehicule_id', label: 'Véhicule', type: 'select',
      options: [{ v: '', l: '—' }, ...vehicules.map((v) => ({ v: v.id, l: v.immatriculation }))] },
    { name: 'date_heure', label: 'Date et heure', type: 'datetime-local', required: true },
    { name: 'type_lecon', label: 'Type', type: 'select', options: [
      { v: 'theorie', l: 'Théorie' }, { v: 'conduite_circulation', l: 'Conduite — circulation' },
      { v: 'conduite_route', l: 'Conduite — route' }, { v: 'conduite_autoroute', l: 'Conduite — autoroute' }] },
    ...(id ? [
      { name: 'presence', label: 'Présence', type: 'select', options: [
        { v: 'prevue', l: 'Prévue' }, { v: 'present', l: 'Présent' }, { v: 'absent', l: 'Absent' }] },
      { name: 'note_perf', label: 'Note performance (/20)', type: 'number' },
      { name: 'observations', label: 'Observations du moniteur', type: 'textarea' },
      { name: 'status', label: 'Statut', type: 'select', options: [
        { v: 'prevue', l: 'Prévue' }, { v: 'effectuee', l: 'Effectuée' }, { v: 'annulee', l: 'Annulée' }] },
    ] : []),
  ], cur, async (fd) => {
    if (fd.date_heure) fd.date_heure = fd.date_heure.replace('T', ' ');
    await api(id ? '/lecons/' + id : '/lecons', { method: id ? 'PUT' : 'POST', body: fd });
    toast('Leçon enregistrée'); go('lecons');
  });
};

RENDER.paiements = async () => {
  $('#header-actions').innerHTML =
    `<div class="flex gap-2">${btnPrimary('💳 Paiement Mobile Money', 'formEbilling()')}${btnPrimary('+ Paiement manuel', 'formPaiement()')}</div>`;
  const list = await api('/paiements');
  const rows = list.map((p) => `<tr class="hover:bg-slate-50">
    <td class="px-4 py-2 whitespace-nowrap">${fmtDate(p.date_paiement)}</td>
    <td class="px-4 py-2">${esc(p.eleve_prenom || '')} ${esc(p.eleve_nom || '')}</td>
    <td class="px-4 py-2">${LABEL[p.type]}${p.libelle ? ` — ${esc(p.libelle)}` : ''}</td>
    <td class="px-4 py-2 font-semibold">${fcfa(p.montant)}</td>
    <td class="px-4 py-2">${LABEL[p.moyen] || p.moyen}</td>
    <td class="px-4 py-2">${badge(p.statut)}</td>
    <td class="px-4 py-2 text-right whitespace-nowrap">
      <button onclick="recu(${p.id})" class="text-brand hover:underline">Reçu</button>
      ${p.reference && p.statut === 'en_attente' ? `· <button onclick="verifierPaie(${p.id})" class="text-orange-500 hover:underline">Vérifier</button>` : ''}
    </td></tr>`).join('');
  $('#view').innerHTML = tableWrap(['Date', 'Élève', 'Objet', 'Montant', 'Moyen', 'Statut', ''], rows);
};

window.formPaiement = async () => {
  const eleves = await api('/eleves');
  formModal('Paiement manuel (espèces / au guichet)', [
    { name: 'eleve_id', label: 'Élève', type: 'select', required: true,
      options: eleves.map((e) => ({ v: e.id, l: `${e.prenom} ${e.nom}` })) },
    { name: 'type', label: 'Type', type: 'select', options: [
      { v: 'inscription', l: 'Inscription' }, { v: 'lecon', l: 'Leçon' },
      { v: 'examen', l: 'Examen' }, { v: 'pack', l: 'Pack' }] },
    { name: 'montant', label: 'Montant (FCFA)', type: 'number', required: true },
    { name: 'libelle', label: 'Libellé' },
    { name: 'moyen', label: 'Moyen', type: 'select', options: [
      { v: 'especes', l: 'Espèces' }, { v: 'airtel', l: 'Airtel Money' }, { v: 'moov', l: 'Moov Money' }] },
  ], {}, async (fd) => {
    await api('/paiements', { method: 'POST', body: fd });
    toast('Paiement enregistré'); go('paiements');
  });
};

window.formEbilling = async () => {
  const eleves = await api('/eleves');
  formModal('Paiement Mobile Money (E-Billing)', [
    { name: 'eleve_id', label: 'Élève', type: 'select', required: true,
      options: eleves.map((e) => ({ v: e.id, l: `${e.prenom} ${e.nom}` })) },
    { name: 'type', label: 'Type', type: 'select', options: [
      { v: 'inscription', l: 'Inscription' }, { v: 'lecon', l: 'Leçon' },
      { v: 'examen', l: 'Examen' }, { v: 'pack', l: 'Pack' }] },
    { name: 'montant', label: 'Montant (FCFA)', type: 'number', required: true },
    { name: 'libelle', label: 'Libellé' },
  ], {}, async (fd) => {
    const r = await api('/paiements/ebilling/init', { method: 'POST', body: fd });
    toast(r.ussd_pousse ? 'Demande USSD envoyée au téléphone de l’élève' : 'Paiement initié — voir la page de paiement');
    go('paiements');
  });
};

window.verifierPaie = async (id) => {
  try { const r = await api('/paiements/' + id + '/verifier', { method: 'POST' });
    toast(r.paye ? 'Paiement confirmé ✓' : 'Toujours en attente (' + r.statut + ')', r.paye); go('paiements');
  } catch (e) { toast(e.message, false); }
};

window.recu = async (id) => {
  const p = await api('/paiements/' + id + '/recu');
  openModal(`
    <div class="p-6" id="recu-print">
      <div class="text-center border-b pb-3 mb-3">
        <div class="text-2xl">🚗</div>
        <div class="font-bold text-marine-800">AUTO-ÉCOLE BÉTHEL</div>
        <div class="text-xs text-slate-500">Lambaréné</div>
        <div class="text-xs text-slate-500">Reçu de paiement N°${p.id}</div>
      </div>
      <table class="w-full text-sm">
        <tr><td class="py-1 text-slate-500">Élève</td><td class="py-1 text-right font-medium">${esc(p.eleve_prenom)} ${esc(p.eleve_nom)}</td></tr>
        <tr><td class="py-1 text-slate-500">Identité</td><td class="py-1 text-right">${esc(p.id_identite || '—')}</td></tr>
        <tr><td class="py-1 text-slate-500">Objet</td><td class="py-1 text-right">${LABEL[p.type]}${p.libelle ? ' — ' + esc(p.libelle) : ''}</td></tr>
        <tr><td class="py-1 text-slate-500">Moyen</td><td class="py-1 text-right">${LABEL[p.moyen] || p.moyen}</td></tr>
        <tr><td class="py-1 text-slate-500">Date</td><td class="py-1 text-right">${fmtDate(p.date_paiement)}</td></tr>
        <tr><td class="py-2 font-bold border-t">MONTANT</td><td class="py-2 text-right font-bold border-t text-lg">${fcfa(p.montant)}</td></tr>
      </table>
      <div class="mt-3">${badge(p.statut)}</div>
    </div>
    <div class="px-6 pb-6 flex gap-2 justify-end">
      <button onclick="closeModal()" class="px-4 py-2 rounded-lg border">Fermer</button>
      <button onclick="window.print()" class="px-4 py-2 rounded-lg bg-brand text-white">Imprimer</button>
    </div>`);
};

RENDER.examens = async () => {
  if (USER.role === 'admin' || USER.role === 'moniteur') $('#header-actions').innerHTML = btnPrimary('+ Nouvel examen', 'formExamen()');
  const list = await api('/examens');
  const rows = list.map((x) => `<tr class="hover:bg-slate-50">
    <td class="px-4 py-2 whitespace-nowrap">${fmtDate(x.date_examen)}</td>
    <td class="px-4 py-2">${esc(x.eleve_prenom)} ${esc(x.eleve_nom)}</td>
    <td class="px-4 py-2">${LABEL[x.type_examen]}</td>
    <td class="px-4 py-2">${esc(x.moniteur_prenom || '—')}</td>
    <td class="px-4 py-2">${badge(x.resultat)}</td>
    <td class="px-4 py-2 text-right whitespace-nowrap">
      <button onclick="formExamen(${x.id})" class="text-brand hover:underline">Modifier</button>
      ${x.resultat !== 'en_attente' ? `· <button onclick="notifierExamen(${x.id})" class="text-emerald-600 hover:underline">💬 Notifier</button>` : ''}
    </td></tr>`).join('');
  $('#view').innerHTML = tableWrap(['Date', 'Élève', 'Type', 'Moniteur', 'Résultat', ''], rows);
};

window.formExamen = async (id) => {
  const [eleves, moniteurs, list] = await Promise.all([api('/eleves'), api('/moniteurs'), id ? api('/examens') : Promise.resolve([])]);
  const cur = id ? list.find((x) => x.id === id) : {};
  formModal(id ? 'Modifier l’examen' : 'Nouvel examen', [
    { name: 'eleve_id', label: 'Élève', type: 'select', required: true,
      options: eleves.map((e) => ({ v: e.id, l: `${e.prenom} ${e.nom}` })) },
    { name: 'moniteur_id', label: 'Moniteur', type: 'select',
      options: [{ v: '', l: '—' }, ...moniteurs.map((m) => ({ v: m.id, l: `${m.prenom} ${m.nom}` }))] },
    { name: 'type_examen', label: 'Type', type: 'select', options: [
      { v: 'code', l: 'Code' }, { v: 'permis_conduire', l: 'Permis de conduire' }] },
    { name: 'date_examen', label: 'Date', type: 'date', required: true },
    { name: 'resultat', label: 'Résultat', type: 'select', options: [
      { v: 'en_attente', l: 'En attente' }, { v: 'reussi', l: 'Réussi' }, { v: 'echoue', l: 'Échoué' }] },
    { name: 'observations', label: 'Observations', type: 'textarea' },
  ], cur, async (fd) => {
    await api(id ? '/examens/' + id : '/examens', { method: id ? 'PUT' : 'POST', body: fd });
    toast('Examen enregistré'); go('examens');
  });
};

window.notifierExamen = async (id) => {
  const r = await api('/examens/' + id + '/notifier');
  window.open(r.link, '_blank');
};

window.closeModal = closeModal;

/* ---------- Auth / démarrage ---------- */
function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  buildNav();
  $('#user-box').textContent = `${USER.nom || USER.email} · ${USER.role}`;
  go(location.hash.slice(1) || 'dashboard');
}

function logout() {
  localStorage.removeItem('ae_token'); localStorage.removeItem('ae_user');
  TOKEN = ''; USER = null; location.hash = '';
  $('#app').classList.add('hidden'); $('#login-screen').classList.remove('hidden');
}
$('#logout-btn').addEventListener('click', logout);
$('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('-translate-x-full'));

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  try {
    const r = await api('/auth/login', { method: 'POST', body: fd });
    TOKEN = r.token; USER = r.user;
    localStorage.setItem('ae_token', TOKEN); localStorage.setItem('ae_user', JSON.stringify(USER));
    showApp();
  } catch (err) {
    const el = $('#login-error'); el.textContent = err.message; el.classList.remove('hidden');
  }
});

// Reprise de session
if (TOKEN && USER) {
  api('/auth/me').then(showApp).catch(logout);
}

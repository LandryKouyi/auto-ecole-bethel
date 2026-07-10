import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { whatsappLink, modeles } from '../whatsapp.js';

const router = Router();
router.use(requireAuth);

const JOINED = `
  SELECT l.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom, e.telephone AS eleve_tel,
         m.nom AS moniteur_nom, m.prenom AS moniteur_prenom,
         v.immatriculation
  FROM lecons l
  LEFT JOIN eleves e    ON e.id = l.eleve_id
  LEFT JOIN moniteurs m ON m.id = l.moniteur_id
  LEFT JOIN vehicules v ON v.id = l.vehicule_id`;

// Liste filtrable (par date, moniteur, élève, statut). Un moniteur ne voit que ses leçons.
router.get('/', (req, res) => {
  const { date = '', moniteur_id = '', eleve_id = '', status = '' } = req.query;
  let sql = JOINED + ' WHERE 1=1';
  const p = [];
  if (date) { sql += ' AND substr(l.date_heure,1,10) = ?'; p.push(date); }
  if (eleve_id) { sql += ' AND l.eleve_id = ?'; p.push(eleve_id); }
  if (status) { sql += ' AND l.status = ?'; p.push(status); }
  // Restriction moniteur : ne voit que son planning.
  if (req.user.role === 'moniteur' && req.user.moniteur_id) {
    sql += ' AND l.moniteur_id = ?'; p.push(req.user.moniteur_id);
  } else if (moniteur_id) {
    sql += ' AND l.moniteur_id = ?'; p.push(moniteur_id);
  }
  sql += ' ORDER BY l.date_heure DESC LIMIT 300';
  res.json(q.all(sql, ...p));
});

// Détecte un conflit de créneau (même moniteur ou véhicule, même date_heure), hors leçon annulée.
function conflit({ moniteur_id, vehicule_id, date_heure, excludeId = 0 }) {
  if (moniteur_id) {
    const c = q.get(
      "SELECT id FROM lecons WHERE moniteur_id=? AND date_heure=? AND status!='annulee' AND id!=?",
      moniteur_id, date_heure, excludeId);
    if (c) return 'Le moniteur a déjà une leçon à ce créneau';
  }
  if (vehicule_id) {
    const c = q.get(
      "SELECT id FROM lecons WHERE vehicule_id=? AND date_heure=? AND status!='annulee' AND id!=?",
      vehicule_id, date_heure, excludeId);
    if (c) return 'Le véhicule est déjà utilisé à ce créneau';
  }
  return null;
}

// Réserver une leçon
router.post('/', (req, res) => {
  const { eleve_id, moniteur_id = null, vehicule_id = null, date_heure,
          duree_min = 60, type_lecon = 'conduite_circulation', observations = '' } = req.body || {};
  if (!eleve_id || !date_heure) return res.status(400).json({ error: 'Élève et date/heure requis' });
  const err = conflit({ moniteur_id, vehicule_id, date_heure });
  if (err) return res.status(409).json({ error: err });
  const r = q.run(
    `INSERT INTO lecons (eleve_id, moniteur_id, vehicule_id, date_heure, duree_min, type_lecon, observations)
     VALUES (?,?,?,?,?,?,?)`,
    eleve_id, moniteur_id || null, vehicule_id || null, date_heure, duree_min, type_lecon, observations);
  res.status(201).json(q.get(JOINED + ' WHERE l.id = ?', r.lastInsertRowid));
});

// Mettre à jour (présence, observations, note, statut, replanification)
router.put('/:id', (req, res) => {
  const cur = q.get('SELECT * FROM lecons WHERE id = ?', req.params.id);
  if (!cur) return res.status(404).json({ error: 'Leçon introuvable' });
  const f = req.body || {};
  const newDate = f.date_heure ?? cur.date_heure;
  const newMon = f.moniteur_id !== undefined ? f.moniteur_id : cur.moniteur_id;
  const newVeh = f.vehicule_id !== undefined ? f.vehicule_id : cur.vehicule_id;
  if (f.date_heure || f.moniteur_id !== undefined || f.vehicule_id !== undefined) {
    const err = conflit({ moniteur_id: newMon, vehicule_id: newVeh, date_heure: newDate, excludeId: cur.id });
    if (err) return res.status(409).json({ error: err });
  }
  q.run(
    `UPDATE lecons SET moniteur_id=?, vehicule_id=?, date_heure=?, duree_min=?, type_lecon=?,
       presence=?, observations=?, note_perf=?, status=? WHERE id=?`,
    newMon || null, newVeh || null, newDate, f.duree_min ?? cur.duree_min, f.type_lecon ?? cur.type_lecon,
    f.presence ?? cur.presence, f.observations ?? cur.observations,
    f.note_perf !== undefined ? f.note_perf : cur.note_perf, f.status ?? cur.status, req.params.id);
  res.json(q.get(JOINED + ' WHERE l.id = ?', req.params.id));
});

router.delete('/:id', (req, res) => {
  q.run('DELETE FROM lecons WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// Lien WhatsApp de confirmation de leçon
router.get('/:id/confirmation', (req, res) => {
  const l = q.get(JOINED + ' WHERE l.id = ?', req.params.id);
  if (!l) return res.status(404).json({ error: 'Leçon introuvable' });
  const eleve = { prenom: l.eleve_prenom };
  res.json({ link: whatsappLink(l.eleve_tel, modeles.confirmationLecon(eleve, l.date_heure)) });
});

export default router;

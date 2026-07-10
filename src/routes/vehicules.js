import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(q.all(
    `SELECT v.*, m.nom AS moniteur_nom, m.prenom AS moniteur_prenom
     FROM vehicules v LEFT JOIN moniteurs m ON m.id = v.moniteur_id
     ORDER BY v.immatriculation`));
});

router.get('/:id', (req, res) => {
  const v = q.get('SELECT * FROM vehicules WHERE id = ?', req.params.id);
  if (!v) return res.status(404).json({ error: 'Véhicule introuvable' });
  const lecons = q.all(
    `SELECT l.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom
     FROM lecons l LEFT JOIN eleves e ON e.id = l.eleve_id
     WHERE l.vehicule_id = ? ORDER BY l.date_heure DESC LIMIT 50`, req.params.id);
  res.json({ ...v, lecons });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { immatriculation, marque = '', modele = '', statut_maintenance = 'ok',
          date_prochaine_revision = null, moniteur_id = null } = req.body || {};
  if (!immatriculation) return res.status(400).json({ error: 'Immatriculation requise' });
  try {
    const r = q.run(
      'INSERT INTO vehicules (immatriculation, marque, modele, statut_maintenance, date_prochaine_revision, moniteur_id) VALUES (?,?,?,?,?,?)',
      immatriculation, marque, modele, statut_maintenance, date_prochaine_revision, moniteur_id || null);
    res.status(201).json(q.get('SELECT * FROM vehicules WHERE id = ?', r.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: 'Immatriculation déjà existante' });
  }
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const cur = q.get('SELECT * FROM vehicules WHERE id = ?', req.params.id);
  if (!cur) return res.status(404).json({ error: 'Véhicule introuvable' });
  const f = req.body || {};
  q.run(
    `UPDATE vehicules SET immatriculation=?, marque=?, modele=?, statut_maintenance=?, date_prochaine_revision=?, moniteur_id=? WHERE id=?`,
    f.immatriculation ?? cur.immatriculation, f.marque ?? cur.marque, f.modele ?? cur.modele,
    f.statut_maintenance ?? cur.statut_maintenance,
    f.date_prochaine_revision !== undefined ? f.date_prochaine_revision : cur.date_prochaine_revision,
    f.moniteur_id !== undefined ? (f.moniteur_id || null) : cur.moniteur_id, req.params.id);
  res.json(q.get('SELECT * FROM vehicules WHERE id = ?', req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  q.run('DELETE FROM vehicules WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;

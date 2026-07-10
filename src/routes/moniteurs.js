import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = q.all('SELECT * FROM moniteurs ORDER BY nom, prenom');
  // Enrichir avec nb de leçons et note moyenne reçue.
  for (const m of rows) {
    m.nb_lecons = q.get('SELECT COUNT(*) AS c FROM lecons WHERE moniteur_id = ?', m.id).c;
    m.note_moyenne = q.get(
      'SELECT ROUND(AVG(note_perf),1) AS n FROM lecons WHERE moniteur_id = ? AND note_perf IS NOT NULL', m.id).n;
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const m = q.get('SELECT * FROM moniteurs WHERE id = ?', req.params.id);
  if (!m) return res.status(404).json({ error: 'Moniteur introuvable' });
  const lecons = q.all(
    `SELECT l.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom
     FROM lecons l LEFT JOIN eleves e ON e.id = l.eleve_id
     WHERE l.moniteur_id = ? ORDER BY l.date_heure DESC LIMIT 100`, req.params.id);
  const vehicules = q.all('SELECT * FROM vehicules WHERE moniteur_id = ?', req.params.id);
  const stats = q.get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN resultat='reussi' THEN 1 ELSE 0 END) AS reussis
     FROM examens WHERE moniteur_id = ?`, req.params.id);
  res.json({ ...m, lecons, vehicules, stats });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { nom, prenom, licence_num = '', certificat = '', telephone = '', disponibilites_json = '{}' } = req.body || {};
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom requis' });
  const r = q.run(
    'INSERT INTO moniteurs (nom, prenom, licence_num, certificat, telephone, disponibilites_json) VALUES (?,?,?,?,?,?)',
    nom, prenom, licence_num, certificat, telephone,
    typeof disponibilites_json === 'string' ? disponibilites_json : JSON.stringify(disponibilites_json));
  res.status(201).json(q.get('SELECT * FROM moniteurs WHERE id = ?', r.lastInsertRowid));
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const cur = q.get('SELECT * FROM moniteurs WHERE id = ?', req.params.id);
  if (!cur) return res.status(404).json({ error: 'Moniteur introuvable' });
  const f = req.body || {};
  const dispo = f.disponibilites_json != null
    ? (typeof f.disponibilites_json === 'string' ? f.disponibilites_json : JSON.stringify(f.disponibilites_json))
    : cur.disponibilites_json;
  q.run(
    `UPDATE moniteurs SET nom=?, prenom=?, licence_num=?, certificat=?, telephone=?, disponibilites_json=?, actif=? WHERE id=?`,
    f.nom ?? cur.nom, f.prenom ?? cur.prenom, f.licence_num ?? cur.licence_num,
    f.certificat ?? cur.certificat, f.telephone ?? cur.telephone, dispo,
    f.actif ?? cur.actif, req.params.id);
  res.json(q.get('SELECT * FROM moniteurs WHERE id = ?', req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  q.run('DELETE FROM moniteurs WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;

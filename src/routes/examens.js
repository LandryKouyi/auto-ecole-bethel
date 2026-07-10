import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { whatsappLink, modeles } from '../whatsapp.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const { resultat = '', type_examen = '' } = req.query;
  let sql = `SELECT x.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom, e.telephone AS eleve_tel,
                    m.nom AS moniteur_nom, m.prenom AS moniteur_prenom
             FROM examens x
             LEFT JOIN eleves e ON e.id = x.eleve_id
             LEFT JOIN moniteurs m ON m.id = x.moniteur_id WHERE 1=1`;
  const p = [];
  if (resultat) { sql += ' AND x.resultat = ?'; p.push(resultat); }
  if (type_examen) { sql += ' AND x.type_examen = ?'; p.push(type_examen); }
  sql += ' ORDER BY x.date_examen DESC';
  res.json(q.all(sql, ...p));
});

router.post('/', (req, res) => {
  const { eleve_id, moniteur_id = null, type_examen = 'code', date_examen, resultat = 'en_attente', observations = '' } = req.body || {};
  if (!eleve_id || !date_examen) return res.status(400).json({ error: 'Élève et date requis' });
  const r = q.run(
    'INSERT INTO examens (eleve_id, moniteur_id, type_examen, date_examen, resultat, observations) VALUES (?,?,?,?,?,?)',
    eleve_id, moniteur_id || null, type_examen, date_examen, resultat, observations);
  // Répercuter le résultat sur le statut de l'élève.
  syncStatutEleve(eleve_id, resultat);
  res.status(201).json(q.get('SELECT * FROM examens WHERE id = ?', r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const cur = q.get('SELECT * FROM examens WHERE id = ?', req.params.id);
  if (!cur) return res.status(404).json({ error: 'Examen introuvable' });
  const f = req.body || {};
  q.run(
    `UPDATE examens SET moniteur_id=?, type_examen=?, date_examen=?, resultat=?, observations=? WHERE id=?`,
    f.moniteur_id !== undefined ? (f.moniteur_id || null) : cur.moniteur_id,
    f.type_examen ?? cur.type_examen, f.date_examen ?? cur.date_examen,
    f.resultat ?? cur.resultat, f.observations ?? cur.observations, req.params.id);
  syncStatutEleve(cur.eleve_id, f.resultat ?? cur.resultat);
  res.json(q.get('SELECT * FROM examens WHERE id = ?', req.params.id));
});

router.delete('/:id', (req, res) => {
  q.run('DELETE FROM examens WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// Lien WhatsApp du résultat
router.get('/:id/notifier', (req, res) => {
  const x = q.get(
    `SELECT x.*, e.prenom AS eleve_prenom, e.telephone AS eleve_tel
     FROM examens x LEFT JOIN eleves e ON e.id = x.eleve_id WHERE x.id = ?`, req.params.id);
  if (!x) return res.status(404).json({ error: 'Examen introuvable' });
  res.json({ link: whatsappLink(x.eleve_tel, modeles.resultatExamen({ prenom: x.eleve_prenom }, x.resultat === 'reussi')) });
});

// Si l'examen permis est réussi/échoué, on met à jour le statut de l'élève.
function syncStatutEleve(eleve_id, resultat) {
  if (resultat === 'reussi') q.run("UPDATE eleves SET statut='examen_reussi' WHERE id=?", eleve_id);
  else if (resultat === 'echoue') q.run("UPDATE eleves SET statut='examen_echoue' WHERE id=?", eleve_id);
}

export default router;

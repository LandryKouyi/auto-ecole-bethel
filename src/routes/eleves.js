import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';
import { whatsappLink, modeles } from '../whatsapp.js';
import { logAudit } from '../audit.js';

const router = Router();
router.use(requireAuth);

// Liste (avec recherche et filtre statut)
router.get('/', (req, res) => {
  const { search = '', statut = '' } = req.query;
  let sql = 'SELECT * FROM eleves WHERE 1=1';
  const p = [];
  if (search) {
    sql += ' AND (nom LIKE ? OR prenom LIKE ? OR telephone LIKE ? OR id_identite LIKE ?)';
    const s = `%${search}%`;
    p.push(s, s, s, s);
  }
  if (statut) { sql += ' AND statut = ?'; p.push(statut); }
  sql += ' ORDER BY nom, prenom';
  res.json(q.all(sql, ...p));
});

// Détail + historique leçons/paiements/examens + lien WhatsApp
router.get('/:id', (req, res) => {
  const eleve = q.get('SELECT * FROM eleves WHERE id = ?', req.params.id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const lecons = q.all(
    `SELECT l.*, m.nom AS moniteur_nom, m.prenom AS moniteur_prenom, v.immatriculation
     FROM lecons l
     LEFT JOIN moniteurs m ON m.id = l.moniteur_id
     LEFT JOIN vehicules v ON v.id = l.vehicule_id
     WHERE l.eleve_id = ? ORDER BY l.date_heure DESC`, req.params.id);
  const paiements = q.all('SELECT * FROM paiements WHERE eleve_id = ? ORDER BY date_paiement DESC', req.params.id);
  const examens = q.all('SELECT * FROM examens WHERE eleve_id = ? ORDER BY date_examen DESC', req.params.id);
  const totalPaye = q.get(
    "SELECT COALESCE(SUM(montant),0) AS t FROM paiements WHERE eleve_id = ? AND statut = 'paye'", req.params.id).t;
  res.json({
    ...eleve, lecons, paiements, examens, totalPaye,
    whatsapp: whatsappLink(eleve.telephone, `Bonjour ${eleve.prenom}, `),
  });
});

// Créer
router.post('/', (req, res) => {
  const { nom, prenom, telephone = '', adresse = '', id_identite = '', statut = 'en_cours', notes = '' } = req.body || {};
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom requis' });
  const r = q.run(
    'INSERT INTO eleves (nom, prenom, telephone, adresse, id_identite, statut, notes) VALUES (?,?,?,?,?,?,?)',
    nom, prenom, telephone, adresse, id_identite, statut, notes);
  res.status(201).json(q.get('SELECT * FROM eleves WHERE id = ?', r.lastInsertRowid));
});

// Modifier
router.put('/:id', (req, res) => {
  const cur = q.get('SELECT * FROM eleves WHERE id = ?', req.params.id);
  if (!cur) return res.status(404).json({ error: 'Élève introuvable' });
  const f = req.body || {};
  q.run(
    `UPDATE eleves SET nom=?, prenom=?, telephone=?, adresse=?, id_identite=?, statut=?, notes=? WHERE id=?`,
    f.nom ?? cur.nom, f.prenom ?? cur.prenom, f.telephone ?? cur.telephone,
    f.adresse ?? cur.adresse, f.id_identite ?? cur.id_identite,
    f.statut ?? cur.statut, f.notes ?? cur.notes, req.params.id);
  res.json(q.get('SELECT * FROM eleves WHERE id = ?', req.params.id));
});

// Supprimer (admin uniquement) — cascade sur leçons/paiements/examens, donc tracé.
router.delete('/:id', requireRole('admin'), (req, res) => {
  const cur = q.get('SELECT * FROM eleves WHERE id = ?', req.params.id);
  if (!cur) return res.status(404).json({ error: 'Élève introuvable' });
  const nbPaie = q.get('SELECT COUNT(*) AS c FROM paiements WHERE eleve_id = ?', req.params.id).c;
  q.run('DELETE FROM eleves WHERE id = ?', req.params.id);
  logAudit(req, { action: 'eleve.delete', table: 'eleves', id: Number(req.params.id),
    details: { nom: cur.nom, prenom: cur.prenom, paiements_supprimes: nbPaie } });
  res.json({ ok: true });
});

// Lien WhatsApp de rappel de paiement
router.get('/:id/rappel-paiement', (req, res) => {
  const eleve = q.get('SELECT * FROM eleves WHERE id = ?', req.params.id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const solde = q.get(
    "SELECT COALESCE(SUM(montant),0) AS t FROM paiements WHERE eleve_id = ? AND statut = 'en_attente'", req.params.id).t;
  res.json({ link: whatsappLink(eleve.telephone, modeles.rappelPaiement(eleve, solde)), solde });
});

export default router;

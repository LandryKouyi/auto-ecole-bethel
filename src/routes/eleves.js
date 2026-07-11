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

// Liste des impayés : élèves dont le solde (dû − payé) reste positif. Admin uniquement.
router.get('/impayes', requireRole('admin'), (req, res) => {
  const rows = q.all(
    `SELECT e.id, e.nom, e.prenom, e.telephone, e.montant_total_du,
            COALESCE((SELECT SUM(montant) FROM paiements
                      WHERE eleve_id = e.id AND statut = 'paye'), 0) AS total_paye
     FROM eleves e
     WHERE e.montant_total_du > 0`);
  const impayes = rows
    .map((r) => ({ ...r, reste: r.montant_total_du - r.total_paye }))
    .filter((r) => r.reste > 0)
    .sort((a, b) => b.reste - a.reste)
    .map((r) => ({ ...r, whatsapp: whatsappLink(r.telephone, modeles.rappelPaiement(r, r.reste)) }));
  const totalRecouvrer = impayes.reduce((s, r) => s + r.reste, 0);
  res.json({ impayes, totalRecouvrer, nb: impayes.length });
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
  const soldeRestant = eleve.montant_total_du - totalPaye; // > 0 = reste à payer ; < 0 = trop-perçu
  res.json({
    ...eleve, lecons, paiements, examens, totalPaye, soldeRestant,
    whatsapp: whatsappLink(eleve.telephone, `Bonjour ${eleve.prenom}, `),
  });
});

// Créer
router.post('/', (req, res) => {
  const { nom, prenom, telephone = '', adresse = '', id_identite = '', statut = 'en_cours', notes = '', montant_total_du = 0 } = req.body || {};
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom requis' });
  const r = q.run(
    'INSERT INTO eleves (nom, prenom, telephone, adresse, id_identite, statut, notes, montant_total_du) VALUES (?,?,?,?,?,?,?,?)',
    nom, prenom, telephone, adresse, id_identite, statut, notes, Math.round(Number(montant_total_du) || 0));
  res.status(201).json(q.get('SELECT * FROM eleves WHERE id = ?', r.lastInsertRowid));
});

// Modifier
router.put('/:id', (req, res) => {
  const cur = q.get('SELECT * FROM eleves WHERE id = ?', req.params.id);
  if (!cur) return res.status(404).json({ error: 'Élève introuvable' });
  const f = req.body || {};
  const nouveauDu = f.montant_total_du != null ? Math.round(Number(f.montant_total_du) || 0) : cur.montant_total_du;
  q.run(
    `UPDATE eleves SET nom=?, prenom=?, telephone=?, adresse=?, id_identite=?, statut=?, notes=?, montant_total_du=? WHERE id=?`,
    f.nom ?? cur.nom, f.prenom ?? cur.prenom, f.telephone ?? cur.telephone,
    f.adresse ?? cur.adresse, f.id_identite ?? cur.id_identite,
    f.statut ?? cur.statut, f.notes ?? cur.notes, nouveauDu, req.params.id);
  // Toute modification du montant convenu est tracée : sinon on pourrait masquer un trou en baissant le dû.
  if (nouveauDu !== cur.montant_total_du) {
    logAudit(req, { action: 'eleve.montant_du', table: 'eleves', id: Number(req.params.id),
      details: { avant: cur.montant_total_du, apres: nouveauDu, eleve: `${cur.prenom} ${cur.nom}` } });
  }
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

// Lien WhatsApp de rappel de paiement (solde réel = montant convenu − déjà payé)
router.get('/:id/rappel-paiement', (req, res) => {
  const eleve = q.get('SELECT * FROM eleves WHERE id = ?', req.params.id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const paye = q.get(
    "SELECT COALESCE(SUM(montant),0) AS t FROM paiements WHERE eleve_id = ? AND statut = 'paye'", req.params.id).t;
  const solde = eleve.montant_total_du - paye;
  res.json({ link: whatsappLink(eleve.telephone, modeles.rappelPaiement(eleve, solde)), solde });
});

export default router;

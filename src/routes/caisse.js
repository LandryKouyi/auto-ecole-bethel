import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';
import { logAudit } from '../audit.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// Total théorique des ESPÈCES encaissées un jour donné (seul le cash transite par la caisse physique).
function etatJour(date) {
  const agg = q.get(
    `SELECT COUNT(*) AS nb, COALESCE(SUM(montant),0) AS total
     FROM paiements
     WHERE moyen='especes' AND statut='paye' AND substr(date_paiement,1,10)=?`, date);
  const lignes = q.all(
    `SELECT p.id, p.numero_recu, p.montant, p.type, p.libelle, p.date_paiement, p.created_by_nom,
            e.nom AS eleve_nom, e.prenom AS eleve_prenom
     FROM paiements p LEFT JOIN eleves e ON e.id=p.eleve_id
     WHERE p.moyen='especes' AND p.statut='paye' AND substr(p.date_paiement,1,10)=?
     ORDER BY p.date_paiement`, date);
  const cloture = q.get('SELECT * FROM cloture_caisse WHERE date_caisse=? ORDER BY id DESC LIMIT 1', date);
  return { date, total_theorique: agg.total, nb_paiements: agg.nb, lignes, cloture: cloture || null };
}

// GET /api/caisse/jour?date=YYYY-MM-DD — état de caisse du jour (défaut : aujourd'hui)
router.get('/jour', (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  res.json(etatJour(date));
});

// POST /api/caisse/cloture — enregistre le comptage physique et calcule l'écart
router.post('/cloture', (req, res) => {
  const date = String(req.body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const montantCompte = Math.round(Number(req.body?.montant_compte));
  if (!Number.isFinite(montantCompte) || montantCompte < 0) {
    return res.status(400).json({ error: 'Montant compté invalide' });
  }
  const commentaire = String(req.body?.commentaire || '').trim();
  const etat = etatJour(date);
  const ecart = montantCompte - etat.total_theorique;
  const r = q.run(
    `INSERT INTO cloture_caisse
       (date_caisse, user_id, user_nom, total_theorique, montant_compte, ecart, nb_paiements, commentaire)
     VALUES (?,?,?,?,?,?,?,?)`,
    date, req.user.uid, req.user.nom || '', etat.total_theorique, montantCompte, ecart,
    etat.nb_paiements, commentaire);
  logAudit(req, { action: 'caisse.cloture', table: 'cloture_caisse', id: r.lastInsertRowid,
    details: { date, total_theorique: etat.total_theorique, montant_compte: montantCompte, ecart } });
  res.status(201).json({ ok: true, ecart, total_theorique: etat.total_theorique, id: r.lastInsertRowid });
});

// GET /api/caisse/historique — clôtures passées (écarts visibles en un coup d'œil)
router.get('/historique', (req, res) => {
  res.json(q.all('SELECT * FROM cloture_caisse ORDER BY date_caisse DESC, id DESC LIMIT 90'));
});

export default router;

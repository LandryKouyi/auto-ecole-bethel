import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();
router.use(requireAuth);

// GET /api/dashboard — indicateurs clés + séries pour graphiques
router.get('/', (req, res) => {
  const moisCourant = new Date().toISOString().slice(0, 7); // YYYY-MM

  const caMois = q.get(
    `SELECT COALESCE(SUM(montant),0) AS t FROM paiements
     WHERE statut='paye' AND substr(date_paiement,1,7)=?`, moisCourant).t;

  const elevesActifs = q.get("SELECT COUNT(*) AS c FROM eleves WHERE statut='en_cours'").c;
  const elevesTotal = q.get('SELECT COUNT(*) AS c FROM eleves').c;

  const leconsPrevues = q.get(
    "SELECT COUNT(*) AS c FROM lecons WHERE status='prevue' AND date_heure >= datetime('now')").c;

  const leconsJour = q.all(
    `SELECT l.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom,
            m.nom AS moniteur_nom, m.prenom AS moniteur_prenom, v.immatriculation
     FROM lecons l
     LEFT JOIN eleves e ON e.id=l.eleve_id
     LEFT JOIN moniteurs m ON m.id=l.moniteur_id
     LEFT JOIN vehicules v ON v.id=l.vehicule_id
     WHERE substr(l.date_heure,1,10)=date('now') ORDER BY l.date_heure`);

  // Revenus des 6 derniers mois
  const revenus = q.all(
    `SELECT substr(date_paiement,1,7) AS mois, SUM(montant) AS total
     FROM paiements WHERE statut='paye'
       AND date_paiement >= date('now','-6 months')
     GROUP BY mois ORDER BY mois`);

  // Taux de réussite aux examens (global)
  const ex = q.get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN resultat='reussi' THEN 1 ELSE 0 END) AS reussis,
            SUM(CASE WHEN resultat='echoue' THEN 1 ELSE 0 END) AS echoues
     FROM examens WHERE resultat IN ('reussi','echoue')`);
  const tauxReussite = ex.total ? Math.round((ex.reussis / ex.total) * 100) : 0;

  // Taux de réussite par moniteur
  const reussiteParMoniteur = q.all(
    `SELECT m.id, m.nom, m.prenom,
            COUNT(x.id) AS total,
            SUM(CASE WHEN x.resultat='reussi' THEN 1 ELSE 0 END) AS reussis
     FROM moniteurs m
     LEFT JOIN examens x ON x.moniteur_id=m.id AND x.resultat IN ('reussi','echoue')
     GROUP BY m.id HAVING total > 0 ORDER BY reussis DESC`);

  // Alertes véhicules (maintenance non OK)
  const alertesVehicules = q.all(
    "SELECT id, immatriculation, statut_maintenance, date_prochaine_revision FROM vehicules WHERE statut_maintenance != 'ok'");

  // Paiements en attente (solde à relancer)
  const paiementsEnAttente = q.get(
    "SELECT COUNT(*) AS c, COALESCE(SUM(montant),0) AS t FROM paiements WHERE statut='en_attente'");

  // Argent à recouvrer : somme des soldes (dû − payé) positifs sur tous les élèves.
  const soldes = q.all(
    `SELECT e.montant_total_du AS du,
            COALESCE((SELECT SUM(montant) FROM paiements
                      WHERE eleve_id = e.id AND statut='paye'), 0) AS paye
     FROM eleves e WHERE e.montant_total_du > 0`);
  const aRecouvrer = soldes.reduce((s, r) => s + Math.max(0, r.du - r.paye), 0);
  const nbImpayes = soldes.filter((r) => r.du - r.paye > 0).length;

  res.json({
    caMois, elevesActifs, elevesTotal, leconsPrevues, leconsJour,
    revenus, tauxReussite, examens: ex, reussiteParMoniteur,
    alertesVehicules, paiementsEnAttente, aRecouvrer, nbImpayes,
  });
});

export default router;

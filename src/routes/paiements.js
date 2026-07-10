import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { initPayment, checkPayment, ebillingConfigure } from '../ebilling.js';

const router = Router();

// --- Notification E-Billing (PUBLIC, pas d'auth : appelé par SHAP/Digitech) ---
// On ne fait JAMAIS confiance au corps reçu : on revérifie côté serveur par bill_id.
router.post('/webhook', async (req, res) => {
  const billId = req.body?.bill_id || req.body?.billId || req.query?.bill_id;
  const ref = req.body?.reference || req.body?.external_reference;
  const paiement = billId
    ? q.get('SELECT * FROM paiements WHERE reference = ?', String(billId))
    : q.get('SELECT * FROM paiements WHERE reference = ?', String(ref || ''));
  if (!paiement) return res.status(404).json({ error: 'Paiement inconnu' });
  if (paiement.statut === 'paye') return res.json({ ok: true, deja: true });
  try {
    const { paye } = await checkPayment(paiement.reference);
    q.run("UPDATE paiements SET statut = ?, date_paiement = datetime('now') WHERE id = ?",
      paye ? 'paye' : paiement.statut, paiement.id);
    res.json({ ok: true, paye });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// À partir d'ici : routes protégées.
router.use(requireAuth);

// Liste (filtre par élève ou statut)
router.get('/', (req, res) => {
  const { eleve_id = '', statut = '' } = req.query;
  let sql = `SELECT p.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom
             FROM paiements p LEFT JOIN eleves e ON e.id = p.eleve_id WHERE 1=1`;
  const p = [];
  if (eleve_id) { sql += ' AND p.eleve_id = ?'; p.push(eleve_id); }
  if (statut) { sql += ' AND p.statut = ?'; p.push(statut); }
  sql += ' ORDER BY p.date_paiement DESC LIMIT 300';
  res.json(q.all(sql, ...p));
});

// Enregistrer un paiement manuel (espèces / Mobile Money encaissé au guichet)
router.post('/', (req, res) => {
  const { eleve_id, montant, type = 'lecon', libelle = '', moyen = 'especes', statut = 'paye' } = req.body || {};
  if (!eleve_id || !montant) return res.status(400).json({ error: 'Élève et montant requis' });
  const r = q.run(
    'INSERT INTO paiements (eleve_id, montant, type, libelle, moyen, statut) VALUES (?,?,?,?,?,?)',
    eleve_id, Math.round(montant), type, libelle, moyen, statut);
  res.status(201).json(q.get('SELECT * FROM paiements WHERE id = ?', r.lastInsertRowid));
});

// Initier un paiement Mobile Money en ligne via E-Billing (push USSD au téléphone de l'élève)
router.post('/ebilling/init', async (req, res) => {
  if (!ebillingConfigure()) {
    return res.status(503).json({ error: 'E-Billing non configuré sur ce serveur (clés absentes). Utilisez le paiement manuel.' });
  }
  const { eleve_id, montant, type = 'lecon', libelle = '' } = req.body || {};
  if (!eleve_id || !montant) return res.status(400).json({ error: 'Élève et montant requis' });
  const eleve = q.get('SELECT * FROM eleves WHERE id = ?', eleve_id);
  if (!eleve) return res.status(404).json({ error: 'Élève introuvable' });
  const transaction_id = `AE-${Date.now()}-${eleve_id}`;
  // On crée le paiement "en_attente" AVANT d'appeler E-Billing.
  const r = q.run(
    'INSERT INTO paiements (eleve_id, montant, type, libelle, moyen, statut, reference) VALUES (?,?,?,?,?,?,?)',
    eleve_id, Math.round(montant), type, libelle, 'ebilling', 'en_attente', transaction_id);
  try {
    const info = await initPayment({
      transaction_id, montant: Math.round(montant),
      description: libelle || `Paiement ${type} - ${eleve.prenom} ${eleve.nom}`,
      client: eleve,
    });
    // On garde le bill_id comme référence de vérité.
    q.run('UPDATE paiements SET reference = ? WHERE id = ?', info.bill_id, r.lastInsertRowid);
    res.json({
      paiement_id: r.lastInsertRowid, bill_id: info.bill_id,
      ussd_pousse: info.ussd_pousse, operateur: info.operateur,
      payment_url: info.payment_url,
    });
  } catch (e) {
    q.run('UPDATE paiements SET statut = ? WHERE id = ?', 'echoue', r.lastInsertRowid);
    res.status(502).json({ error: e.message });
  }
});

// Vérifier manuellement l'état d'un paiement E-Billing (bouton "Rafraîchir")
router.post('/:id/verifier', async (req, res) => {
  const p = q.get('SELECT * FROM paiements WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Paiement introuvable' });
  if (!p.reference) return res.status(400).json({ error: 'Pas de référence E-Billing' });
  try {
    const { paye, statut } = await checkPayment(p.reference);
    q.run('UPDATE paiements SET statut = ? WHERE id = ?', paye ? 'paye' : p.statut, p.id);
    res.json({ paye, statut });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Générer un reçu (données JSON pour impression/PDF côté client)
router.get('/:id/recu', (req, res) => {
  const p = q.get(
    `SELECT p.*, e.nom AS eleve_nom, e.prenom AS eleve_prenom, e.telephone AS eleve_tel, e.id_identite
     FROM paiements p LEFT JOIN eleves e ON e.id = p.eleve_id WHERE p.id = ?`, req.params.id);
  if (!p) return res.status(404).json({ error: 'Paiement introuvable' });
  res.json(p);
});

export default router;

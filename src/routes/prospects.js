import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';
import { whatsappLink, modeles } from '../whatsapp.js';
import { logAudit } from '../audit.js';

const router = Router();

// --- PUBLIC : réception d'une demande de pré-inscription depuis la landing page ---
// Pas d'auth (formulaire public). Validation minimale + garde-fous anti-spam basiques.
router.post('/', (req, res) => {
  const { nom = '', prenom = '', telephone = '', formule = '', message = '' } = req.body || {};
  if (!String(prenom).trim() || !String(telephone).trim()) {
    return res.status(400).json({ error: 'Prénom et téléphone requis' });
  }
  // Bornage des longueurs pour éviter les abus.
  const clip = (v, n) => String(v).slice(0, n);
  const r = q.run(
    `INSERT INTO prospects (nom, prenom, telephone, formule, message, source)
     VALUES (?,?,?,?,?,?)`,
    clip(nom, 80), clip(prenom, 80), clip(telephone, 30), clip(formule, 80), clip(message, 500), 'landing');
  res.status(201).json({ ok: true, id: r.lastInsertRowid });
});

// --- À partir d'ici : réservé à l'administration ---
router.use(requireAuth, requireRole('admin'));

// Liste des demandes (filtre statut)
router.get('/', (req, res) => {
  const { statut = '' } = req.query;
  let sql = 'SELECT * FROM prospects WHERE 1=1';
  const p = [];
  if (statut) { sql += ' AND statut = ?'; p.push(statut); }
  sql += ' ORDER BY (statut = \'nouveau\') DESC, created_at DESC LIMIT 300';
  const rows = q.all(sql, ...p).map((r) => ({
    ...r,
    whatsapp: whatsappLink(r.telephone, `Bonjour ${r.prenom}, merci pour votre demande à l'Auto-École Béthel. `),
  }));
  res.json(rows);
});

// Changer le statut d'un prospect
router.put('/:id/statut', (req, res) => {
  const p = q.get('SELECT * FROM prospects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Prospect introuvable' });
  const statut = String(req.body?.statut || '');
  if (!['nouveau', 'contacte', 'converti', 'perdu'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  q.run('UPDATE prospects SET statut = ? WHERE id = ?', statut, p.id);
  logAudit(req, { action: 'prospect.statut', table: 'prospects', id: p.id,
    details: { avant: p.statut, apres: statut } });
  res.json({ ok: true });
});

// Convertir un prospect en élève (crée la fiche élève et marque le prospect « converti »)
router.post('/:id/convertir', (req, res) => {
  const p = q.get('SELECT * FROM prospects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Prospect introuvable' });
  if (p.eleve_id) return res.status(400).json({ error: 'Prospect déjà converti' });
  const r = q.run(
    'INSERT INTO eleves (nom, prenom, telephone, notes) VALUES (?,?,?,?)',
    p.nom || p.prenom, p.prenom, p.telephone,
    p.formule ? `Prospect — formule souhaitée : ${p.formule}` : 'Issu de la landing page');
  q.run("UPDATE prospects SET statut = 'converti', eleve_id = ? WHERE id = ?", r.lastInsertRowid, p.id);
  logAudit(req, { action: 'prospect.convertir', table: 'prospects', id: p.id,
    details: { eleve_id: r.lastInsertRowid, prenom: p.prenom } });
  res.status(201).json({ ok: true, eleve_id: r.lastInsertRowid });
});

export default router;

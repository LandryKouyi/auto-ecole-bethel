// Gestion des comptes de connexion (réservée à l'admin).
// Permet de créer le login d'un moniteur ajouté via l'app, réinitialiser un mot de
// passe, activer/désactiver un compte — sans jamais toucher à la base à la main.
import { Router } from 'express';
import { q } from '../db.js';
import { hashPassword } from '../auth.js';
import { requireAuth, requireRole } from '../middleware.js';
import { logAudit } from '../audit.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const ROLES = ['admin', 'moniteur'];
const publicFields = (u) => ({
  id: u.id, email: u.email, nom: u.nom, role: u.role,
  moniteur_id: u.moniteur_id, actif: u.actif, created_at: u.created_at,
  moniteur_nom: u.moniteur_nom || null,
});

// Nombre d'admins encore actifs (pour ne jamais se verrouiller dehors).
const nbAdminsActifs = () =>
  q.get("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND actif = 1").c;

// GET /api/users — liste des comptes
router.get('/', (req, res) => {
  const rows = q.all(`
    SELECT u.*, (m.prenom || ' ' || m.nom) AS moniteur_nom
    FROM users u LEFT JOIN moniteurs m ON m.id = u.moniteur_id
    ORDER BY u.role, u.nom`);
  res.json(rows.map(publicFields));
});

// GET /api/users/moniteurs-sans-compte — moniteurs qui n'ont pas encore de login
router.get('/moniteurs-sans-compte', (req, res) => {
  const rows = q.all(`
    SELECT m.id, m.prenom, m.nom FROM moniteurs m
    WHERE m.actif = 1 AND m.id NOT IN (SELECT moniteur_id FROM users WHERE moniteur_id IS NOT NULL)
    ORDER BY m.nom`);
  res.json(rows);
});

// POST /api/users — créer un compte
router.post('/', (req, res) => {
  let { email, nom = '', role = 'moniteur', moniteur_id = null, password } = req.body || {};
  email = String(email || '').toLowerCase().trim();
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  if (q.get('SELECT id FROM users WHERE email = ?', email)) {
    return res.status(409).json({ error: 'Un compte utilise déjà cet email' });
  }
  moniteur_id = moniteur_id ? Number(moniteur_id) : null;
  if (moniteur_id && !q.get('SELECT id FROM moniteurs WHERE id = ?', moniteur_id)) {
    return res.status(400).json({ error: 'Moniteur introuvable' });
  }
  const r = q.run(
    'INSERT INTO users (email, password_hash, nom, role, moniteur_id) VALUES (?,?,?,?,?)',
    email, hashPassword(String(password)), nom, role, moniteur_id);
  logAudit(req, { action: 'user.create', table: 'users', id: r.lastInsertRowid, details: { email, role, moniteur_id } });
  const u = q.get('SELECT * FROM users WHERE id = ?', r.lastInsertRowid);
  res.status(201).json(publicFields(u));
});

// PUT /api/users/:id — modifier nom / rôle / moniteur lié / actif
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const cur = q.get('SELECT * FROM users WHERE id = ?', id);
  if (!cur) return res.status(404).json({ error: 'Compte introuvable' });
  const f = req.body || {};

  const nom = f.nom ?? cur.nom;
  const role = f.role != null ? String(f.role) : cur.role;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  const moniteur_id = f.moniteur_id !== undefined ? (f.moniteur_id ? Number(f.moniteur_id) : null) : cur.moniteur_id;
  const actif = f.actif !== undefined ? (Number(f.actif) ? 1 : 0) : cur.actif;

  // Garde-fous : ne pas se verrouiller dehors ni se désactiver soi-même.
  const perdDroitsAdmin = cur.role === 'admin' && (role !== 'admin' || actif === 0);
  if (perdDroitsAdmin && nbAdminsActifs() <= 1) {
    return res.status(400).json({ error: 'Impossible : ce serait le dernier administrateur actif.' });
  }
  if (id === req.user.uid && actif === 0) {
    return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
  }

  q.run('UPDATE users SET nom=?, role=?, moniteur_id=?, actif=? WHERE id=?', nom, role, moniteur_id, actif, id);
  logAudit(req, { action: 'user.update', table: 'users', id, details: { nom, role, moniteur_id, actif } });
  res.json(publicFields(q.get('SELECT * FROM users WHERE id = ?', id)));
});

// POST /api/users/:id/password — l'admin réinitialise le mot de passe d'un compte
router.post('/:id/password', (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  const cur = q.get('SELECT id FROM users WHERE id = ?', id);
  if (!cur) return res.status(404).json({ error: 'Compte introuvable' });
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
  }
  q.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(password)), id);
  logAudit(req, { action: 'user.password_reset', table: 'users', id, details: 'Réinitialisation par un administrateur' });
  res.json({ ok: true });
});

// DELETE /api/users/:id — supprimer un compte (protège dernier admin + soi-même)
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const cur = q.get('SELECT * FROM users WHERE id = ?', id);
  if (!cur) return res.status(404).json({ error: 'Compte introuvable' });
  if (id === req.user.uid) return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  if (cur.role === 'admin' && nbAdminsActifs() <= 1) {
    return res.status(400).json({ error: 'Impossible : ce serait le dernier administrateur actif.' });
  }
  q.run('DELETE FROM users WHERE id = ?', id);
  logAudit(req, { action: 'user.delete', table: 'users', id, details: { email: cur.email } });
  res.json({ ok: true });
});

export default router;

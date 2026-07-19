import { Router } from 'express';
import { q } from '../db.js';
import { verifyPassword, hashPassword, signToken } from '../auth.js';
import { requireAuth } from '../middleware.js';
import { logAudit } from '../audit.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const user = q.get('SELECT * FROM users WHERE email = ?', String(email).toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  if (user.actif === 0) return res.status(403).json({ error: 'Compte désactivé. Contactez l\'administrateur.' });
  const token = signToken({ uid: user.id, role: user.role, moniteur_id: user.moniteur_id, nom: user.nom });
  res.json({
    token,
    user: { id: user.id, email: user.email, nom: user.nom, role: user.role, moniteur_id: user.moniteur_id },
  });
});

// GET /api/auth/me — infos de l'utilisateur courant
router.get('/me', requireAuth, (req, res) => {
  const user = q.get('SELECT id, email, nom, role, moniteur_id FROM users WHERE id = ?', req.user.uid);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

// POST /api/auth/password — l'utilisateur change SON propre mot de passe.
router.post('/password', requireAuth, (req, res) => {
  const { ancien, nouveau } = req.body || {};
  if (!ancien || !nouveau) return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis' });
  if (String(nouveau).length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  const user = q.get('SELECT * FROM users WHERE id = ?', req.user.uid);
  if (!user || !verifyPassword(ancien, user.password_hash)) {
    return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
  }
  q.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(nouveau)), user.id);
  logAudit(req, { action: 'user.password_change', table: 'users', id: user.id, details: 'Changement de son propre mot de passe' });
  res.json({ ok: true });
});

export default router;

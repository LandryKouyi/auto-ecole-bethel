import { Router } from 'express';
import { q } from '../db.js';
import { verifyPassword, signToken } from '../auth.js';
import { requireAuth } from '../middleware.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const user = q.get('SELECT * FROM users WHERE email = ?', String(email).toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
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

export default router;

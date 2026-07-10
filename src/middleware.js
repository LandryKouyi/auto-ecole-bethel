// Middlewares d'authentification et d'autorisation.
import { verifyToken } from './auth.js';

// Exige un jeton valide. Attache req.user = { uid, role, moniteur_id, ... }.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });
  req.user = payload;
  next();
}

// Restreint l'accès à certains rôles. Ex: requireRole('admin').
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé (rôle insuffisant)' });
    }
    next();
  };
}

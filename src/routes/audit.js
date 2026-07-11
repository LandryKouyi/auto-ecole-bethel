import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();
// Le journal d'audit n'est consultable que par l'administration.
router.use(requireAuth, requireRole('admin'));

// GET /api/audit — dernières entrées, filtrables par action ou cible
router.get('/', (req, res) => {
  const { action = '', table = '', limit = 200 } = req.query;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const p = [];
  if (action) { sql += ' AND action LIKE ?'; p.push(action + '%'); }
  if (table) { sql += ' AND cible_table = ?'; p.push(table); }
  sql += ' ORDER BY id DESC LIMIT ?';
  p.push(Math.min(Number(limit) || 200, 500));
  res.json(q.all(sql, ...p));
});

export default router;

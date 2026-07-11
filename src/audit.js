// Traçabilité : journal d'audit + numérotation continue des reçus.
import { q } from './db.js';

// Enregistre une action sensible. Ne lève jamais (l'audit ne doit pas casser l'action métier).
// Utilisation : logAudit(req, { action:'paiement.create', table:'paiements', id, details:{...} })
export function logAudit(req, { action, table = '', id = null, details = '' }) {
  try {
    const u = req?.user || {};
    const ip = (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').toString().split(',')[0].trim();
    q.run(
      `INSERT INTO audit_log (user_id, user_nom, role, action, cible_table, cible_id, details, ip)
       VALUES (?,?,?,?,?,?,?,?)`,
      u.uid ?? null, u.nom || '', u.role || '', action, table, id,
      typeof details === 'string' ? details : JSON.stringify(details), ip);
  } catch (e) {
    console.error('[audit] échec journalisation:', e.message);
  }
}

// Attribue un numéro de reçu séquentiel (continu, jamais réutilisé) à un paiement encaissé.
// La continuité de la séquence est la garantie anti-fraude : un trou = un encaissement manquant.
// Idempotent : ne fait rien si le paiement en a déjà un.
export function assignReceiptNumber(paiementId) {
  const p = q.get('SELECT id, numero_recu FROM paiements WHERE id = ?', paiementId);
  if (!p || p.numero_recu) return p?.numero_recu || null;
  const next = (q.get('SELECT COALESCE(MAX(numero_recu),0) AS m FROM paiements').m) + 1;
  q.run('UPDATE paiements SET numero_recu = ? WHERE id = ?', next, paiementId);
  return next;
}

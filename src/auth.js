// Authentification : hachage scrypt + JWT HS256 fait main (zéro dépendance).
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-a-changer';
const TOKEN_TTL = 60 * 60 * 12; // 12 h

// --- Mots de passe (scrypt) ---
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return ref.length === test.length && timingSafeEqual(ref, test);
}

// --- JWT HS256 ---
const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlJson = (obj) => b64url(JSON.stringify(obj));

function sign(data) {
  return b64url(createHmac('sha256', JWT_SECRET).update(data).digest());
}

export function signToken(payload) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlJson({ ...payload, iat: now, exp: now + TOKEN_TTL });
  const data = `${header}.${body}`;
  return `${data}.${sign(data)}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = sign(`${header}.${body}`);
  // Comparaison à temps constant.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

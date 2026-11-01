// Password hashing (scrypt) and HS256 JSON Web Tokens using only node:crypto.
import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const scryptP = (pw, salt) => new Promise((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await scryptP(pw, salt)).toString('hex')}`;
}
export async function verifyPassword(pw, stored) {
  const [s, h] = String(stored).split(':');
  if (!s || !h) return false;
  const k = await scryptP(pw, Buffer.from(s, 'hex'));
  const b = Buffer.from(h, 'hex');
  return k.length === b.length && timingSafeEqual(k, b);
}

const b64 = (x) => Buffer.from(x).toString('base64url');
export function signToken(payload, secret, ttlSec = 60 * 60 * 24 * 30) {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
export function verifyToken(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const sig = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], 'base64url');
  if (sig.length !== given.length || !timingSafeEqual(sig, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

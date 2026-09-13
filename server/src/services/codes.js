import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Keyed hash: a leaked database alone can't be brute-forced back to the 6-digit codes.
export function hashCode(code) {
  return crypto.createHmac('sha256', env.jwtSecret).update(String(code)).digest('hex');
}

export function codeMatches(code, hash) {
  if (typeof hash !== 'string') return false;
  const a = Buffer.from(hashCode(code), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Seconds left before another code may be sent, or 0.
export function cooldownRemaining(lastSentAt, now = Date.now()) {
  if (!lastSentAt) return 0;
  return Math.max(0, Math.ceil((lastSentAt.getTime() + RESEND_COOLDOWN_MS - now) / 1000));
}

export function codeIsFresh(lastSentAt, now = Date.now()) {
  return Boolean(lastSentAt) && now - lastSentAt.getTime() <= CODE_TTL_MS;
}

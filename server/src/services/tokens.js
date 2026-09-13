import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'cc_session';
const SESSION_DAYS = 30;
const ALGORITHM = 'HS256';

export function signSession(user) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion, typ: 'session' }, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: `${SESSION_DAYS}d`,
  });
}

// Returns { sub, tv } or null. Purpose tokens are rejected because their `typ` differs.
export function verifySession(token) {
  const payload = verifyPurposeToken(token, 'session');
  return payload && typeof payload.sub === 'string' ? payload : null;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  path: '/',
});

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function signIn(res, user) {
  setSessionCookie(res, signSession(user));
}

// Short-lived tokens for a single purpose, e.g. finishing a Google sign-up (typ 'google-signup').
export function signPurposeToken(payload, typ, expiresIn) {
  return jwt.sign({ ...payload, typ }, env.jwtSecret, { algorithm: ALGORITHM, expiresIn });
}

export function verifyPurposeToken(token, typ) {
  if (typeof token !== 'string' || !token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] });
    return payload.typ === typ ? payload : null;
  } catch {
    return null;
  }
}

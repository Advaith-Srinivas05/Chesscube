import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { clearSessionCookie, SESSION_COOKIE, verifySession } from '../services/tokens.js';
import { HttpError } from './errors.js';

// Sets req.user to the signed-in User document, or null. Invalid or revoked cookies are cleared.
export async function optionalAuth(req, res, next) {
  req.user = null;
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();

  const session = verifySession(token);
  const user =
    session && mongoose.isValidObjectId(session.sub) ? await User.findById(session.sub) : null;

  if (user && user.tokenVersion === session.tv) {
    req.user = user;
  } else {
    clearSessionCookie(res);
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) throw new HttpError(401, 'Sign in required');
  next();
}

import bcrypt from 'bcryptjs';

const COST = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

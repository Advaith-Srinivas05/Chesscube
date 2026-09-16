import { PendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';

// An unverified sign-up keeps its username for this long after it started. Resending codes doesn't extend it,
// so nobody can hold a name indefinitely without verifying an email.
export const USERNAME_HOLD_MS = 30 * 60 * 1000;

// Query for pending sign-ups that still hold their username. (Sign-ups from before startedAt existed count until
// they expire.)
export function holdingUsername(now = new Date()) {
  return {
    expiresAt: { $gt: now },
    $or: [{ startedAt: { $gt: new Date(now.getTime() - USERNAME_HOLD_MS) } }, { startedAt: { $exists: false } }],
  };
}

// True when a User (other than `exceptUserId`), or a recent unverified sign-up for another email, holds the username.
export async function usernameTaken(name, { email, exceptUserId } = {}) {
  const usernameLower = name.toLowerCase();
  const userQuery = exceptUserId ? { usernameLower, _id: { $ne: exceptUserId } } : { usernameLower };
  if (await User.exists(userQuery)) return true;
  const pending = await PendingSignup.findOne({ usernameLower, ...holdingUsername() }, { email: 1 }).lean();
  return Boolean(pending && pending.email !== email);
}

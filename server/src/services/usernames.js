import { PendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';

// True when a User (other than `exceptUserId`), or an unexpired sign-up for another email, holds the username.
export async function usernameTaken(name, { email, exceptUserId } = {}) {
  const usernameLower = name.toLowerCase();
  const userQuery = exceptUserId ? { usernameLower, _id: { $ne: exceptUserId } } : { usernameLower };
  if (await User.exists(userQuery)) return true;
  const pending = await PendingSignup.findOne({ usernameLower, expiresAt: { $gt: new Date() } }, { email: 1 }).lean();
  return Boolean(pending && pending.email !== email);
}

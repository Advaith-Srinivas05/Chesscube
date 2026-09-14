import { EmailCode } from '../models/EmailCode.js';
import { User } from '../models/User.js';

// Removes everything that belongs only to this user. Later features (friends, games, live sessions)
// add their own clean-up here. The username and email are free again as soon as this resolves.
export async function deleteAccount(userId) {
  await EmailCode.deleteMany({ userId });
  await User.deleteOne({ _id: userId });
}

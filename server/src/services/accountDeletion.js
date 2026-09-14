import { EmailCode } from '../models/EmailCode.js';
import { Friendship } from '../models/Friendship.js';
import { User } from '../models/User.js';

// Removes everything that belongs only to this user. Later features (games, live sessions)
// add their own clean-up here. The username and email are free again as soon as this resolves.
export async function deleteAccount(userId) {
  await EmailCode.deleteMany({ userId });
  await Friendship.deleteMany({ $or: [{ from: userId }, { to: userId }] });
  await User.deleteOne({ _id: userId });
}

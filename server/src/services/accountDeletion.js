import { EmailCode } from '../models/EmailCode.js';
import { Friendship } from '../models/Friendship.js';
import { Game } from '../models/Game.js';
import { User } from '../models/User.js';
import { disconnectUser } from '../realtime/connections.js';
import { endGameOf } from '../realtime/games.js';

// Removes everything that belongs only to this user. Later features add their own clean-up here.
// The username and email are free again as soon as this resolves.
export async function deleteAccount(userId) {
  const id = String(userId);
  // A live game ends as a resignation (or abort) before the account disappears, so the opponent is rated normally.
  await endGameOf(id);
  disconnectUser(id);

  await EmailCode.deleteMany({ userId });
  await Friendship.deleteMany({ $or: [{ from: userId }, { to: userId }] });

  // Finished games stay for the other player ("Deleted user"), unless that player is gone too.
  const games = await Game.find({ players: userId }).select('players').lean();
  const others = [...new Set(games.flatMap((game) => game.players.map(String)).filter((other) => other !== id))];
  const remaining = new Set((await User.find({ _id: { $in: others } }).select('_id').lean()).map((user) => String(user._id)));
  const orphaned = games.filter((game) => !game.players.some((player) => remaining.has(String(player))));
  if (orphaned.length) await Game.deleteMany({ _id: { $in: orphaned.map((game) => game._id) } });

  await User.deleteOne({ _id: userId });
}

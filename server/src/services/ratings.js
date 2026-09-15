import { rateGame } from '../lib/glicko2.js';
import { User } from '../models/User.js';

const SCORES = { '1-0': 1, '0-1': 0, '1/2-1/2': 0.5 };

/**
 * Glicko-2 update for a finished rated game between two users. Returns the displayed rating changes
 * { white, black }, or null when nothing was rated (casual, aborted, guests, or a deleted player).
 */
export async function applyGameResult(session) {
  const { category, result, rated, population } = session;
  if (!rated || population !== 'users' || !(result in SCORES)) return null;

  const users = await User.find({ _id: { $in: [session.white.id, session.black.id] } })
    .select(`ratings.${category}`)
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user.ratings[category]]));
  const white = byId.get(session.white.id);
  const black = byId.get(session.black.id);
  if (!white || !black) return null;

  const [newWhite, newBlack] = rateGame(white, black, SCORES[result]);
  const update = (id, rating) =>
    User.updateOne(
      { _id: id },
      {
        $set: { [`ratings.${category}.r`]: rating.r, [`ratings.${category}.rd`]: rating.rd, [`ratings.${category}.vol`]: rating.vol },
        $inc: { [`ratings.${category}.n`]: 1 },
      }
    );
  await Promise.all([update(session.white.id, newWhite), update(session.black.id, newBlack)]);

  // Differences of the rounded ratings, so the numbers people see add up.
  return {
    white: Math.round(newWhite.r) - Math.round(white.r),
    black: Math.round(newBlack.r) - Math.round(black.r),
  };
}

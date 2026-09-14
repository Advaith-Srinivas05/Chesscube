import { Router } from 'express';
import { PROVISIONAL_RD } from '../lib/glicko2.js';
import { HttpError } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { CATEGORIES } from '../shared/gameModes.js';

const TOP_LIMIT = 100;
const CACHE_MS = 60 * 1000;
const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

// category -> { expires, players: Promise }. Only the top list is cached; `me` is computed per request.
const cache = new Map();

async function loadTop(category) {
  const key = `ratings.${category}`;
  const users = await User.find({ [`${key}.n`]: { $gte: 1 } })
    .sort({ [`${key}.r`]: -1, _id: 1 })
    .limit(TOP_LIMIT)
    .select(`username avatar ${key}`)
    .lean();
  return users.map((user, index) => {
    const { r, rd, n } = user.ratings[category];
    return { rank: index + 1, username: user.username, avatar: user.avatar, rating: Math.round(r), provisional: rd > PROVISIONAL_RD, games: n };
  });
}

function topPlayers(category) {
  const cached = cache.get(category);
  if (cached && cached.expires > Date.now()) return cached.players;
  const players = loadTop(category);
  cache.set(category, { expires: Date.now() + CACHE_MS, players });
  // A failed query shouldn't stay cached.
  players.catch(() => cache.delete(category));
  return players;
}

// Same order as the top list (rating, then _id), so a listed user's rank matches their row.
async function rankOf(user, category) {
  const { r, n } = user.ratings[category];
  if (!n) return null;
  const key = `ratings.${category}`;
  const ahead = await User.countDocuments({
    [`${key}.n`]: { $gte: 1 },
    $or: [{ [`${key}.r`]: { $gt: r } }, { [`${key}.r`]: r, _id: { $lt: user._id } }],
  });
  return { rank: ahead + 1, rating: Math.round(r) };
}

export const leaderboardRouter = Router();

leaderboardRouter.get('/:category', async (req, res) => {
  const { category } = req.params;
  if (!CATEGORY_IDS.has(category)) throw new HttpError(404, 'Unknown leaderboard');

  const [players, me] = await Promise.all([topPlayers(category), req.user ? rankOf(req.user, category) : null]);
  res.json({ players, me });
});

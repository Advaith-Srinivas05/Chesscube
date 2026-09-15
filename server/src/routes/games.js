import { Router } from 'express';
import { GAME_ID_RE } from '../lib/ids.js';
import { HttpError } from '../middleware/errors.js';
import { Game } from '../models/Game.js';
import { User } from '../models/User.js';

export const gamesRouter = Router();

// A finished game for replay and analysis. Live games are opened through the socket instead.
gamesRouter.get('/:id', async (req, res) => {
  if (!GAME_ID_RE.test(req.params.id)) throw new HttpError(404, 'Game not found');
  const game = await Game.findById(req.params.id).lean();
  if (!game) throw new HttpError(404, 'Game not found');
  if (game.status === 'active') throw new HttpError(409, 'Game in progress', 'LIVE', { live: true });

  const users = await User.find({ _id: { $in: game.players } }).select('username avatar').lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const side = ({ user, rating, diff }) => {
    const player = byId.get(String(user));
    return { username: player?.username ?? null, avatar: player?.avatar ?? null, rating: rating ?? null, diff: diff ?? null };
  };

  res.json({
    game: {
      id: game._id,
      variant: game.variant,
      initialFen: game.initialFen ?? null,
      tc: game.tc,
      rated: game.rated,
      category: game.category,
      white: side(game.white),
      black: side(game.black),
      moves: game.moves ? game.moves.split(' ') : [],
      result: game.result,
      termination: game.termination,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
    },
  });
});

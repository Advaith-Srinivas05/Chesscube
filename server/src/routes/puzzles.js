import { Router } from 'express';
import { z } from 'zod';
import { checkAttempt, solutionOf } from '../lib/chess/puzzle.js';
import { rate } from '../lib/glicko2.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { ipKeyGenerator, limiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { Puzzle } from '../models/Puzzle.js';
import { User } from '../models/User.js';
import { applyDailySolve, dayNumber, effectiveStreak, getOrPickDaily } from '../services/dailyPuzzle.js';

const MINUTE = 60 * 1000;
const RATING_WINDOWS = [75, 150, 300, 600];
const GUEST_RATING = { $gte: 600, $lte: 1800 };
const RECENT_LIMIT = 100;

const moves = z
  .array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/, 'Invalid move'), { error: 'Moves must be a list' })
  .max(30, 'Too many moves');

// The solution is sent along, as on Lichess; the client hides rating and themes until the puzzle ends.
const toClient = (puzzle) => ({
  id: puzzle._id,
  fen: puzzle.fen,
  moves: solutionOf(puzzle),
  rating: puzzle.rating,
  themes: puzzle.themes ? puzzle.themes.split(' ') : [],
});

const sampleOne = async (match) => (await Puzzle.aggregate([{ $match: match }, { $sample: { size: 1 } }]))[0] ?? null;

async function pickForUser(user) {
  const target = Math.round(user.ratings.puzzle.r);
  const recent = user.puzzle?.recent ?? [];
  for (const window of RATING_WINDOWS) {
    const puzzle = await sampleOne({ rating: { $gte: target - window, $lte: target + window }, _id: { $nin: recent } });
    if (puzzle) return puzzle;
  }
  return sampleOne({ _id: { $nin: recent } });
}

const perUserOrIp = (req) => req.user?.id ?? ipKeyGenerator(req.ip);

export const puzzlesRouter = Router();

puzzlesRouter.get('/next', limiter({ windowMs: MINUTE, limit: 60, keyGenerator: perUserOrIp }), async (req, res) => {
  const { user } = req;
  if (!user) {
    const puzzle = (await sampleOne({ rating: GUEST_RATING })) ?? (await sampleOne({}));
    if (!puzzle) throw new HttpError(503, 'No puzzles available yet');
    return res.json({ puzzle: toClient(puzzle) });
  }

  // An unfinished puzzle comes back, so refreshing can't skip a hard one.
  const current = user.puzzle?.current ? await Puzzle.findById(user.puzzle.current) : null;
  if (current) return res.json({ puzzle: toClient(current) });

  const puzzle = await pickForUser(user);
  if (!puzzle) throw new HttpError(503, 'No puzzles available yet');
  await User.updateOne({ _id: user._id }, { $set: { 'puzzle.current': puzzle._id } });
  res.json({ puzzle: toClient(puzzle) });
});

// ---- Daily puzzle (defined before /:id so "daily" isn't taken as an id) ----

puzzlesRouter.get('/daily', requireAuth, async (req, res) => {
  const today = dayNumber();
  const { date, puzzle } = await getOrPickDaily(today);
  const state = req.user.puzzle ?? {};
  res.json({
    date,
    puzzle: toClient(puzzle),
    solved: state.lastDaily === today,
    streak: effectiveStreak(state, today),
    best: state.best ?? 0,
  });
});

puzzlesRouter.post(
  '/daily/attempt',
  requireAuth,
  limiter({ windowMs: MINUTE, limit: 30, keyGenerator: (req) => req.user.id }),
  validate({ body: z.object({ date: z.string().max(10), moves }) }),
  async (req, res) => {
    const today = dayNumber();
    const { date, puzzle } = await getOrPickDaily(today);
    if (req.body.date !== date) throw new HttpError(409, 'A new daily puzzle is out. Reload to get it.', 'DAILY_CHANGED');

    const { solved } = checkAttempt(puzzle, req.body.moves);
    if (!solved) return res.json({ solved: false });

    const { user } = req;
    const next = applyDailySolve(user.puzzle ?? {}, today);
    // Conditional on lastDaily, so two solves racing on the same day count once.
    const updated = await User.findOneAndUpdate(
      { _id: user._id, 'puzzle.lastDaily': { $ne: today } },
      { $set: { 'puzzle.streak': next.streak, 'puzzle.best': next.best, 'puzzle.lastDaily': today } },
      { returnDocument: 'after' }
    );
    const saved = updated ?? (await User.findById(user._id));
    res.json({
      solved: true,
      streak: effectiveStreak(saved.puzzle, today),
      best: saved.puzzle?.best ?? 0,
      user: saved.toSelf(),
    });
  }
);

// ---- Rated puzzles ----

puzzlesRouter.post(
  '/:id/attempt',
  requireAuth,
  limiter({ windowMs: MINUTE, limit: 60, keyGenerator: (req) => req.user.id }),
  validate({ params: z.object({ id: z.string().regex(/^[A-Za-z0-9]{1,12}$/, 'Invalid puzzle id') }), body: z.object({ moves }) }),
  async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    if (user.puzzle?.current !== id) throw new HttpError(409, 'Puzzle not active', 'PUZZLE_NOT_ACTIVE');

    const puzzle = await Puzzle.findById(id);
    if (!puzzle) throw new HttpError(404, 'Puzzle not found');

    const { solved, failedAt } = checkAttempt(puzzle, req.body.moves);
    const before = user.ratings.puzzle;
    const after = rate(before, [{ r: puzzle.rating, rd: puzzle.rd, score: solved ? 1 : 0 }]);

    // Conditional on puzzle.current, so the same attempt can't be counted twice.
    const updated = await User.findOneAndUpdate(
      { _id: user._id, 'puzzle.current': id },
      {
        $set: { 'ratings.puzzle.r': after.r, 'ratings.puzzle.rd': after.rd, 'ratings.puzzle.vol': after.vol },
        $inc: { 'ratings.puzzle.n': 1 },
        $push: { 'puzzle.recent': { $each: [id], $slice: -RECENT_LIMIT } },
        $unset: { 'puzzle.current': 1 },
      },
      { returnDocument: 'after' }
    );
    if (!updated) throw new HttpError(409, 'Puzzle not active', 'PUZZLE_NOT_ACTIVE');

    const self = updated.toSelf();
    res.json({
      solved,
      failedAt,
      rating: self.ratings.puzzle,
      diff: Math.round(after.r) - Math.round(before.r),
      solution: solutionOf(puzzle),
      user: self,
    });
  }
);

import { DailyPuzzle } from '../models/DailyPuzzle.js';
import { Puzzle } from '../models/Puzzle.js';

const DAY_MS = 86_400_000;

// Missing this many days in a row keeps the streak; one more resets it.
export const STREAK_MAX_MISSED_DAYS = 2;

export const dayNumber = (date = new Date()) => Math.floor(date.getTime() / DAY_MS);
export const dayKey = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);

const streakBroken = (lastDaily, today) => lastDaily != null && today - lastDaily - 1 > STREAK_MAX_MISSED_DAYS;

// The streak as it stands today: 0 once too many days were missed, even before the next solve.
export function effectiveStreak(puzzleState, today = dayNumber()) {
  if (!puzzleState || streakBroken(puzzleState.lastDaily, today)) return 0;
  return puzzleState.streak ?? 0;
}

// New { streak, best, lastDaily } after solving the daily puzzle on `today`.
export function applyDailySolve({ streak = 0, best = 0, lastDaily } = {}, today = dayNumber()) {
  if (lastDaily === today) return { streak, best, lastDaily };
  const next = lastDaily == null || streakBroken(lastDaily, today) ? 1 : streak + 1;
  return { streak: next, best: Math.max(best, next), lastDaily: today };
}

// Easy, well-tested puzzles only; every day gets one nobody has seen as a daily before.
async function pickPuzzleId() {
  const used = await DailyPuzzle.distinct('puzzleId');
  for (const maxRating of [1100, 1300, 3000]) {
    const [puzzle] = await Puzzle.aggregate([
      {
        $match: {
          rating: { $gte: 600, $lte: maxRating },
          plays: { $gte: 2000 },
          themes: /\b(oneMove|short)\b/,
          _id: { $nin: used },
        },
      },
      { $sample: { size: 1 } },
      { $project: { _id: 1 } },
    ]);
    if (puzzle) return puzzle._id;
  }
  const [any] = await Puzzle.aggregate([{ $sample: { size: 1 } }, { $project: { _id: 1 } }]);
  if (!any) throw new Error('The puzzles collection is empty; run npm run import:puzzles');
  return any._id;
}

// Today's daily puzzle document, picked on first request. The upsert makes simultaneous requests agree.
export async function getOrPickDaily(today = dayNumber()) {
  const date = dayKey(today);
  const existing = await DailyPuzzle.findById(date);
  const daily =
    existing ??
    (await DailyPuzzle.findOneAndUpdate(
      { _id: date },
      { $setOnInsert: { puzzleId: await pickPuzzleId() } },
      { upsert: true, returnDocument: 'after' }
    ));
  const puzzle = await Puzzle.findById(daily.puzzleId);
  if (!puzzle) throw new Error(`Daily puzzle ${daily.puzzleId} is missing from the puzzles collection`);
  return { date, puzzle };
}

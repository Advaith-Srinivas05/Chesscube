import { User } from '../models/User.js';

// Wrong password reset codes allowed per account in a rolling window. Requesting a new code doesn't reset this
// count (it does reset the per-code attempts), so guessing is capped at a few tries a day.
export const RESET_GUESS_LIMIT = 10;
export const RESET_GUARD_WINDOW_MS = 24 * 60 * 60 * 1000;

export function resetLocked(guard, now = Date.now()) {
  if (!guard?.since) return false;
  return now - new Date(guard.since).getTime() < RESET_GUARD_WINDOW_MS && guard.guesses >= RESET_GUESS_LIMIT;
}

export async function recordWrongResetGuess(userId, now = new Date()) {
  const windowOpen = { $gt: ['$resetGuard.since', new Date(now.getTime() - RESET_GUARD_WINDOW_MS)] };
  await User.collection.updateOne({ _id: userId }, [
    {
      $set: {
        resetGuard: {
          $cond: [
            windowOpen,
            { guesses: { $add: ['$resetGuard.guesses', 1] }, since: '$resetGuard.since' },
            { guesses: 1, since: now },
          ],
        },
      },
    },
  ]);
}

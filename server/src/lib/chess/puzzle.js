// Mirrored in client/src/lib/chess/puzzle.js and server/src/lib/chess/puzzle.js — keep both copies identical.
import { makeUci } from 'chessops/util';
import { applyMove, parseMove, positionFromFen } from './rules.js';

// Lichess puzzles: `fen` is the position before the opponent's move, solution[0] is that move,
// and the solver plays the moves at odd indexes.
export function solutionOf(puzzle) {
  return Array.isArray(puzzle.moves) ? puzzle.moves : String(puzzle.moves).trim().split(/\s+/);
}

// Position after the opponent's first move, where the solver starts.
export function puzzleStart(puzzle) {
  const pos = positionFromFen(puzzle.fen);
  applyMove(pos, solutionOf(puzzle)[0]);
  return pos;
}

/**
 * Whether `uci` is the right move in `pos` for the expected solution move. Castling notations are
 * normalised before comparing. On the last move any checkmate counts, as on Lichess.
 */
export function isSolutionMove(pos, uci, expected, isLast) {
  const move = parseMove(pos, uci);
  if (!move) return false;
  const want = parseMove(pos, expected);
  if (want && makeUci(move) === makeUci(want)) return true;
  if (!isLast) return false;
  const after = pos.clone();
  after.play(move);
  return after.isCheckmate();
}

// Replays `submitted` (the solver's moves only) against the solution. failedAt is the index of the
// first wrong move, or null. solved needs every solver move, all correct.
export function checkAttempt(puzzle, submitted) {
  const solution = solutionOf(puzzle);
  const needed = Math.floor(solution.length / 2);
  let pos;
  try {
    pos = puzzleStart(puzzle);
  } catch {
    return { solved: false, failedAt: 0 };
  }

  for (let index = 0; index < submitted.length; index++) {
    const solutionIndex = 2 * index + 1;
    if (index >= needed) return { solved: false, failedAt: index };
    const isLast = solutionIndex === solution.length - 1;
    if (!isSolutionMove(pos, submitted[index], solution[solutionIndex], isLast)) {
      return { solved: false, failedAt: index };
    }
    applyMove(pos, submitted[index]);
    const reply = solution[solutionIndex + 1];
    if (reply && !applyMove(pos, reply)) return { solved: false, failedAt: index + 1 };
  }
  return { solved: submitted.length === needed, failedAt: null };
}

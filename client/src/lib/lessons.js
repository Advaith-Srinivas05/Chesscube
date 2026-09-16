import { Chess } from 'chessops/chess';
import { opposite } from 'chessops/util';
import { isSolutionMove } from './chess/puzzle.js';
import { applyMove, fenOf, positionFromFen } from './chess/rules.js';

// Lesson steps: { text, fen, hint?, intro?, goal }. The player is the side to move in `fen`, or the
// other side when the step has an `intro`: the opponent's opening move, played before the player starts.
// Goals: reach { targets }, captureAll, mate, line { moves } (player at even indexes), move { moves }.
// A line move is a UCI string, or { anyExcept: [squares] } for a free player move (e.g. a waiting
// move) that may not come from one of those squares.
// Plain chessops only, so scripts/validateLessons.js runs this in Node too.

export const GOAL_TYPES = ['reach', 'captureAll', 'mate', 'line', 'move'];

const DEFAULT_HINTS = {
  mate: "That isn't checkmate. Look for a move the king can't escape from.",
  line: "That's not the move we're looking for. Try again.",
  free: 'Leave that piece where it is and play something else.',
  move: "That's not the move we're looking for. Try again.",
  handBack: "In this drill, don't give check. Try another move.",
};

// Drills where only the player moves (reach, captureAll): after each move the turn comes straight back
// and en passant is cleared. Returns null when that position isn't valid (e.g. the other king is in check).
export function handBack(pos, color) {
  const setup = pos.toSetup();
  setup.turn = color;
  setup.epSquare = undefined;
  const result = Chess.fromSetup(setup);
  return result.isOk ? result.value : null;
}

export function piecesLeft(pos, color) {
  return pos.board[color].diff(pos.board.king).size();
}

export function startStep(step) {
  const pos = positionFromFen(step.fen);
  // With an `intro`, the step starts one move behind: `before` is what the board shows until the
  // opponent's move has been played out, and the player is the side to move after it.
  const before = step.intro ? fenOf(pos) : null;
  const intro = step.intro ? applyMove(pos, step.intro) : null;
  if (step.intro && !intro) throw new Error(`Illegal opening move ${step.intro}`);
  return { pos, player: pos.turn, reached: new Set(), ply: 0, done: false, intro, before };
}

/**
 * Judges the player's move and, when it's accepted, advances `state` (mutated).
 * → { verdict: 'illegal' }
 * → { verdict: 'wrong', played, hint }: `played.fen` shows the move before it's taken back
 * → { verdict: 'ok', played, done }
 */
export function playStepMove(step, state, uci) {
  const { goal } = step;
  const after = state.pos.clone();
  const played = applyMove(after, uci);
  if (!played) return { verdict: 'illegal' };
  const wrong = (hint) => ({ verdict: 'wrong', played, hint: step.hint ?? hint });
  const accept = (pos, done) => {
    state.pos = pos;
    state.done = done;
    return { verdict: 'ok', played: { ...played, fen: fenOf(pos) }, done };
  };

  switch (goal.type) {
    case 'mate':
      return after.isCheckmate() ? accept(after, true) : wrong(DEFAULT_HINTS.mate);

    case 'move':
      return goal.moves.some((expected) => isSolutionMove(state.pos, uci, expected, false))
        ? accept(after, true)
        : wrong(DEFAULT_HINTS.move);

    case 'line': {
      const expected = goal.moves[state.ply];
      const isLast = state.ply === goal.moves.length - 1;
      if (typeof expected === 'string') {
        if (!isSolutionMove(state.pos, uci, expected, isLast)) return wrong(DEFAULT_HINTS.line);
      } else if (expected.anyExcept.includes(played.uci.slice(0, 2))) {
        return wrong(DEFAULT_HINTS.free);
      }
      state.ply += 1;
      return accept(after, state.ply >= goal.moves.length);
    }

    case 'reach':
    case 'captureAll': {
      const target = played.uci.slice(2, 4);
      const done =
        goal.type === 'reach'
          ? goal.targets.every((square) => square === target || state.reached.has(square))
          : piecesLeft(after, opposite(state.player)) === 0;
      // A finished drill keeps its final position; otherwise the player moves again.
      const next = done ? after : handBack(after, state.player);
      if (!next) return wrong(DEFAULT_HINTS.handBack);
      if (goal.type === 'reach' && goal.targets.includes(target)) state.reached.add(target);
      return accept(next, done);
    }

    default:
      return { verdict: 'illegal' };
  }
}

// Plays the opponent's scripted reply in a `line` step. Returns the move, or null when none is due.
export function playStepReply(step, state) {
  if (step.goal.type !== 'line' || state.done || state.ply % 2 === 0) return null;
  const played = applyMove(state.pos, step.goal.moves[state.ply]);
  if (!played) return null;
  state.ply += 1;
  return played;
}

// Squares still to visit in a `reach` step.
export function remainingTargets(step, state) {
  return step.goal.type === 'reach' ? step.goal.targets.filter((square) => !state.reached.has(square)) : [];
}

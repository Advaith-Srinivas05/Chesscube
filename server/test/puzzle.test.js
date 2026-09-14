import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkAttempt, puzzleStart, solutionOf } from '../src/lib/chess/puzzle.js';
import { fenOf } from '../src/lib/chess/rules.js';
import { applyDailySolve, effectiveStreak } from '../src/services/dailyPuzzle.js';

// Back-rank mate in two: after ...a6, Re8+ Rxe8 Rxe8#.
const backRank = { fen: '1r4k1/p4ppp/8/8/8/8/4RPPP/4R1K1 b - - 0 1', moves: 'a7a6 e2e8 b8e8 e1e8' };

describe('puzzle checking', () => {
  test('the solver starts after the opponent move', () => {
    assert.deepEqual(solutionOf({ moves: ' a7a6  e2e8 ' }), ['a7a6', 'e2e8']);
    assert.equal(fenOf(puzzleStart(backRank)), '1r4k1/5ppp/p7/8/8/8/4RPPP/4R1K1 w - - 0 2');
  });

  test('the full line solves', () => {
    assert.deepEqual(checkAttempt(backRank, ['e2e8', 'e1e8']), { solved: true, failedAt: null });
  });

  test('a partial line is neither solved nor failed', () => {
    assert.deepEqual(checkAttempt(backRank, ['e2e8']), { solved: false, failedAt: null });
  });

  test('a wrong, illegal or extra move fails at its index', () => {
    assert.deepEqual(checkAttempt(backRank, ['e2e7']), { solved: false, failedAt: 0 });
    assert.deepEqual(checkAttempt(backRank, ['e2e8', 'e1e7']), { solved: false, failedAt: 1 });
    assert.deepEqual(checkAttempt(backRank, ['zz']), { solved: false, failedAt: 0 });
    assert.deepEqual(checkAttempt(backRank, ['e2e8', 'e1e8', 'g1f1']), { solved: false, failedAt: 2 });
  });

  test('any checkmate counts on the last move', () => {
    const puzzle = { fen: '6k1/p4ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 1', moves: 'a7a6 d1d8' };
    assert.equal(checkAttempt(puzzle, ['d1d8']).solved, true);
    assert.equal(checkAttempt(puzzle, ['e1e8']).solved, true);
    assert.equal(checkAttempt(puzzle, ['d1d7']).solved, false);
  });

  test('castling notation is normalised', () => {
    const puzzle = { fen: 'r3k3/8/8/8/8/8/8/4K2R b K - 0 1', moves: 'a8a7 e1g1' };
    assert.equal(checkAttempt(puzzle, ['e1h1']).solved, true);
    assert.equal(checkAttempt(puzzle, ['e1g1']).solved, true);
    assert.equal(checkAttempt(puzzle, ['e1f1']).solved, false);
  });
});

describe('daily streak', () => {
  const solveOn = (days) => {
    const state = { streak: 0, best: 0, lastDaily: undefined };
    for (const day of days) Object.assign(state, applyDailySolve(state, day));
    return state;
  };

  test('consecutive days increase the streak', () => {
    assert.deepEqual(solveOn([100, 101, 102]), { streak: 3, best: 3, lastDaily: 102 });
  });

  test('solving twice on the same day counts once', () => {
    assert.equal(solveOn([100, 100, 101]).streak, 2);
  });

  test('missing one or two days keeps the streak', () => {
    assert.equal(solveOn([100, 102]).streak, 2);
    assert.equal(solveOn([100, 103]).streak, 2);
    assert.equal(effectiveStreak({ streak: 4, lastDaily: 100 }, 103), 4);
  });

  test('missing three days resets it', () => {
    assert.equal(effectiveStreak({ streak: 4, lastDaily: 100 }, 104), 0);
    assert.deepEqual(solveOn([100, 101, 105]), { streak: 1, best: 2, lastDaily: 105 });
  });

  test('no daily solved yet', () => {
    assert.equal(effectiveStreak({ streak: 0 }, 100), 0);
    assert.deepEqual(solveOn([7]), { streak: 1, best: 1, lastDaily: 7 });
  });
});

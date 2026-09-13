import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { INITIAL_FEN } from 'chessops/fen';
import { chess960BackRank, chess960Fen } from '../src/lib/chess/chess960.js';
import {
  applyMove,
  endState,
  fenOf,
  legalDests,
  parseMove,
  positionFromFen,
  repetitionKey,
  startPosition,
  uciForEngine,
} from '../src/lib/chess/rules.js';

function play(pos, moves, variant = 'standard') {
  const counts = new Map([[repetitionKey(pos), 1]]);
  let state = null;
  for (const uci of moves) {
    assert.ok(!state, `game already ended before ${uci}`);
    const played = applyMove(pos, uci, variant);
    assert.ok(played, `illegal move ${uci}`);
    const key = repetitionKey(pos);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    state = endState(pos, counts);
  }
  return state;
}

const countMoves = (dests) => [...dests.values()].reduce((sum, to) => sum + to.length, 0);

describe('positions', () => {
  test('standard start has 20 legal moves', () => {
    const pos = startPosition('standard');
    assert.equal(fenOf(pos), INITIAL_FEN);
    assert.equal(countMoves(legalDests(pos, 'standard')), 20);
  });

  test('invalid FENs throw readable errors', () => {
    assert.throws(() => positionFromFen('not a fen'), /Invalid FEN/);
    assert.throws(() => positionFromFen('8/8/8/8/8/8/8/8 w - - 0 1'), /empty/);
    assert.throws(() => positionFromFen('8/8/8/8/8/8/8/4K3 w - - 0 1'), /one king/);
  });

  test('Chess960 needs a start FEN', () => {
    assert.throws(() => startPosition('chess960'), /starting FEN/);
    assert.equal(fenOf(startPosition('chess960', chess960Fen(0))), chess960Fen(0));
  });
});

describe('moves', () => {
  test('illegal and malformed moves are rejected', () => {
    const pos = startPosition('standard');
    assert.equal(parseMove(pos, 'e2e5'), null);
    assert.equal(parseMove(pos, 'zz'), null);
    assert.equal(parseMove(pos, 'Q@e4'), null);
    assert.equal(parseMove(pos, undefined), null);
    assert.equal(applyMove(pos, 'e7e5'), null);
    assert.equal(fenOf(pos), INITIAL_FEN);
  });

  test('applyMove returns uci, san and fen', () => {
    const pos = startPosition('standard');
    assert.deepEqual(applyMove(pos, 'g1f3'), {
      uci: 'g1f3',
      san: 'Nf3',
      fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
    });
  });

  test('promotion needs a piece', () => {
    const pos = positionFromFen('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    assert.equal(parseMove(pos, 'e7e8'), null);
    assert.equal(applyMove(pos, 'e7e8q').san, 'e8=Q');
  });

  test('castling accepts both e1g1 and e1h1', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    for (const uci of ['e1g1', 'e1h1']) {
      const pos = positionFromFen(fen);
      const played = applyMove(pos, uci);
      assert.equal(played.uci, 'e1h1');
      assert.equal(played.san, 'O-O');
      assert.equal(pos.board.get(6)?.role, 'king');
      assert.equal(pos.board.get(5)?.role, 'rook');
    }
    const pos = positionFromFen(fen);
    assert.equal(applyMove(pos, 'e1c1').uci, 'e1a1');
    assert.deepEqual(legalDests(positionFromFen(fen), 'standard').get('e1').sort(), ['a1', 'c1', 'd1', 'f1', 'g1', 'h1']);
  });

  test('castling is illegal without the right', () => {
    const pos = positionFromFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w kq - 0 1');
    assert.equal(parseMove(pos, 'e1g1'), null);
    assert.equal(parseMove(pos, 'e1h1'), null);
  });

  test('uciForEngine converts standard castling only', () => {
    const pos = positionFromFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    assert.equal(uciForEngine(pos, parseMove(pos, 'e1h1'), 'standard'), 'e1g1');
    assert.equal(uciForEngine(pos, 'e1a1', 'standard'), 'e1c1');
    assert.equal(uciForEngine(pos, 'e1f1', 'standard'), 'e1f1');
    const black = positionFromFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1');
    assert.equal(uciForEngine(black, 'e8h8', 'standard'), 'e8g8');
    assert.equal(uciForEngine(pos, 'e1h1', 'chess960'), 'e1h1');
  });

  test('Chess960 castling is king-takes-rook only', () => {
    // Position 0: BBQNNRKR — king on g1, rooks on f1 and h1.
    const pos = positionFromFen('bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1');
    assert.deepEqual(legalDests(pos, 'chess960').get('g1') ?? [], []);
    // King on b1 with rooks on a1 and h1 and an empty back rank between.
    const open = positionFromFen('4k3/8/8/8/8/8/8/RK5R w KQ - 0 1');
    assert.equal(parseMove(open, 'b1d1', 'chess960'), null);
    assert.deepEqual(legalDests(open, 'chess960').get('b1').sort(), ['a1', 'a2', 'b2', 'c1', 'c2', 'h1']);
    const played = applyMove(open, 'b1h1', 'chess960');
    assert.equal(played.san, 'O-O');
    assert.equal(open.board.get(6)?.role, 'king');
    assert.equal(open.board.get(5)?.role, 'rook');
  });
});

describe('game end', () => {
  test("fool's mate", () => {
    const state = play(startPosition('standard'), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    assert.deepEqual(state, { result: '0-1', termination: 'checkmate' });
  });

  test('stalemate', () => {
    const pos = positionFromFen('7k/8/6K1/8/8/8/8/5Q2 w - - 0 1');
    assert.deepEqual(play(pos, ['f1f7']), { result: '1/2-1/2', termination: 'stalemate' });
  });

  test('king vs king is insufficient material', () => {
    const state = play(positionFromFen('8/8/8/3k4/8/8/3q4/3K4 w - - 0 1'), ['d1d2']);
    assert.deepEqual(state, { result: '1/2-1/2', termination: 'insufficient' });
  });

  test('threefold repetition via knight shuffles', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const pos = startPosition('standard');
    assert.equal(play(pos, shuffle), null); // start position seen twice
    const state = play(startPosition('standard'), [...shuffle, ...shuffle]);
    assert.deepEqual(state, { result: '1/2-1/2', termination: 'repetition' });
  });

  test('fifty-move rule', () => {
    const pos = positionFromFen('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
    assert.deepEqual(play(pos, ['a1a2']), { result: '1/2-1/2', termination: 'fiftyMove' });
  });

  test('checkmate on the fiftieth move is still checkmate', () => {
    const pos = positionFromFen('7k/8/6K1/8/8/8/8/R7 w - - 99 80');
    assert.deepEqual(play(pos, ['a1a8']), { result: '1-0', termination: 'checkmate' });
  });
});

describe('Chess960', () => {
  test('518 is the standard start position', () => {
    assert.equal(chess960Fen(518), INITIAL_FEN);
  });

  test('rejects numbers outside 0–959', () => {
    for (const n of [-1, 960, 1.5, '5']) assert.throws(() => chess960Fen(n));
  });

  test('all 960 positions are distinct and valid', () => {
    const seen = new Set();
    for (let n = 0; n < 960; n++) {
      const fen = chess960Fen(n);
      const rank = chess960BackRank(n);
      seen.add(fen);

      const bishops = [...rank].flatMap((piece, file) => (piece === 'B' ? [file % 2] : []));
      assert.deepEqual(bishops.sort(), [0, 1], `bishops on the same colour in ${n}`);
      const [rookA, rookB] = [...rank].flatMap((piece, file) => (piece === 'R' ? [file] : []));
      const king = rank.indexOf('K');
      assert.ok(rookA < king && king < rookB, `king not between rooks in ${n}`);
      assert.equal([...rank].sort().join(''), 'BBKNNQRR');

      const pos = positionFromFen(fen);
      assert.equal(pos.castles.castlingRights.size(), 4, `castling rights in ${n}`);
      assert.equal(fenOf(pos), fen, `FEN does not round-trip in ${n}`);
      assert.equal(countMoves(legalDests(pos, 'chess960')) >= 18, true);
    }
    assert.equal(seen.size, 960);
  });
});

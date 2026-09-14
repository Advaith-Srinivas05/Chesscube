import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { INITIAL_FEN } from 'chessops/fen';
import { chess960Fen } from '../src/lib/chess/chess960.js';
import { premoveDests } from '../src/lib/chess/premove.js';

const sorted = (squares) => [...squares].sort();

describe('premoveDests', () => {
  test('pawns: one or two forward from the start rank, plus both diagonals', () => {
    assert.deepEqual(sorted(premoveDests(INITIAL_FEN, 'e2')), ['d3', 'e3', 'e4', 'f3']);
    assert.deepEqual(sorted(premoveDests(INITIAL_FEN, 'a7')), ['a5', 'a6', 'b6']);
    assert.deepEqual(sorted(premoveDests('4k3/8/8/8/8/3P4/8/4K3 w - - 0 1', 'd3')), ['c4', 'd4', 'e4']);
  });

  test('sliders ignore blockers', () => {
    assert.equal(premoveDests(INITIAL_FEN, 'a1').length, 14);
    assert.equal(premoveDests(INITIAL_FEN, 'c1').length, 7);
    assert.equal(premoveDests(INITIAL_FEN, 'd1').length, 21);
    assert.deepEqual(sorted(premoveDests(INITIAL_FEN, 'g1')), ['e2', 'f3', 'h3']);
  });

  test('standard king adds both castling targets and the rook squares while rights remain', () => {
    assert.deepEqual(sorted(premoveDests(INITIAL_FEN, 'e1')), ['a1', 'c1', 'd1', 'd2', 'e2', 'f1', 'f2', 'g1', 'h1']);
    const kingsideOnly = 'r3k2r/8/8/8/8/8/8/R3K2R b k - 0 1';
    assert.deepEqual(sorted(premoveDests(kingsideOnly, 'e8')), ['d7', 'd8', 'e7', 'f7', 'f8', 'g8', 'h8']);
    assert.deepEqual(sorted(premoveDests(kingsideOnly, 'e1')), ['d1', 'd2', 'e2', 'f1', 'f2']);
  });

  test('Chess960 king targets only the castling rook squares', () => {
    const fen = chess960Fen(0); // bbqnnrkr
    assert.deepEqual(sorted(premoveDests(fen, 'g1', 'chess960')), ['f1', 'f2', 'g2', 'h1', 'h2']);
  });

  test('empty squares and bad input give nothing', () => {
    assert.deepEqual(premoveDests(INITIAL_FEN, 'e4'), []);
    assert.deepEqual(premoveDests('nonsense', 'e2'), []);
  });
});

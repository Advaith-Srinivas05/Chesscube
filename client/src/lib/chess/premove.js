// Mirrored in client/src/lib/chess/premove.js and server/src/lib/chess/premove.js — keep both copies identical.
import { bishopAttacks, kingAttacks, knightAttacks, pawnAttacks, queenAttacks, rookAttacks } from 'chessops/attacks';
import { parseFen } from 'chessops/fen';
import { SquareSet } from 'chessops/squareSet';
import { makeSquare, parseSquare, squareFile, squareFromCoords, squareRank } from 'chessops/util';

// Squares a premove from `square` could go to, by geometry alone: blockers, whose turn it is and checks
// are ignored, because the position will have changed by the time the premove is played.
export function premoveDests(fen, square, variant = 'standard') {
  const setup = parseFen(String(fen ?? '').trim());
  const from = parseSquare(square);
  if (setup.isErr || from === undefined) return [];
  const { board, castlingRights } = setup.value;
  const piece = board.get(from);
  if (!piece) return [];

  const empty = SquareSet.empty();
  const file = squareFile(from);
  const rank = squareRank(from);
  let dests = SquareSet.empty();

  switch (piece.role) {
    case 'pawn': {
      const forward = piece.color === 'white' ? 1 : -1;
      const startRank = piece.color === 'white' ? 1 : 6;
      dests = pawnAttacks(piece.color, from);
      const one = squareFromCoords(file, rank + forward);
      if (one !== undefined) dests = dests.with(one);
      if (rank === startRank) dests = dests.with(squareFromCoords(file, rank + 2 * forward));
      break;
    }
    case 'knight':
      dests = knightAttacks(from);
      break;
    case 'bishop':
      dests = bishopAttacks(from, empty);
      break;
    case 'rook':
      dests = rookAttacks(from, empty);
      break;
    case 'queen':
      dests = queenAttacks(from, empty);
      break;
    case 'king': {
      dests = kingAttacks(from);
      const backRank = piece.color === 'white' ? 0 : 7;
      if (rank !== backRank) break;
      for (const rookSquare of castlingRights) {
        if (squareRank(rookSquare) !== backRank) continue;
        const rook = board.get(rookSquare);
        if (rook?.role !== 'rook' || rook.color !== piece.color) continue;
        dests = dests.with(rookSquare);
        // Standard chess also accepts the king's two-square move.
        if (variant !== 'chess960' && file === 4) {
          dests = dests.with(squareFromCoords(squareFile(rookSquare) < file ? 2 : 6, backRank));
        }
      }
      break;
    }
  }

  return [...dests].map(makeSquare);
}

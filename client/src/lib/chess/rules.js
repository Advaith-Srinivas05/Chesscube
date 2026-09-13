// Mirrored in client/src/lib/chess/rules.js and server/src/lib/chess/rules.js — keep both copies identical.
import { castlingSide, Chess, normalizeMove } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { INITIAL_FEN, makeFen, parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { makeUci, parseUci, squareFile } from 'chessops/util';

const POSITION_ERRORS = {
  ERR_EMPTY: 'The board is empty',
  ERR_OPPOSITE_CHECK: 'The side not to move is in check',
  ERR_IMPOSSIBLE_CHECK: 'The position has an impossible check',
  ERR_PAWNS_ON_BACKRANK: 'There are pawns on the first or last rank',
  ERR_KINGS: 'Each side needs exactly one king',
  ERR_VARIANT: 'The position is not valid for this variant',
};

export function positionFromFen(fen) {
  const setup = parseFen(String(fen ?? '').trim());
  if (setup.isErr) throw new Error(`Invalid FEN (${setup.error.message})`);
  const pos = Chess.fromSetup(setup.value);
  if (pos.isErr) throw new Error(`Invalid position: ${POSITION_ERRORS[pos.error.message] ?? pos.error.message}`);
  return pos.value;
}

// Chess960 games always carry their start FEN (see chess960.js); it's never picked here.
export function startPosition(variant, initialFen) {
  if (initialFen) return positionFromFen(initialFen);
  if (variant === 'chess960') throw new Error('A Chess960 game needs its starting FEN');
  return positionFromFen(INITIAL_FEN);
}

export function fenOf(pos) {
  return makeFen(pos.toSetup());
}

// Map<from, to[]>. Standard chess lists both the king's target square and the rook square for castling.
export function legalDests(pos, variant) {
  return chessgroundDests(pos, { chess960: variant === 'chess960' });
}

// Legal chessops move for a UCI string, or null. Castling is normalised to king-takes-rook (e1g1 → e1h1).
// In Chess960 only king-takes-rook is accepted, because a two-square king move there is ambiguous.
export function parseMove(pos, uci, variant = 'standard') {
  const move = typeof uci === 'string' ? parseUci(uci) : undefined;
  if (!move || !('from' in move)) return null;
  if (variant === 'chess960' && castlingSide(pos, move) && !pos.board[pos.turn].has(move.to)) return null;
  const normalised = normalizeMove(pos, move);
  return pos.isLegal(normalised) ? normalised : null;
}

// Plays the move on `pos` (mutating it). Returns null when the move is illegal.
export function applyMove(pos, uci, variant = 'standard') {
  const move = parseMove(pos, uci, variant);
  if (!move) return null;
  const san = makeSan(pos, move);
  pos.play(move);
  return { uci: makeUci(move), san, fen: fenOf(pos) };
}

// Board, turn, castling rights and en passant square: the parts that make positions "the same" for repetition.
export function repetitionKey(pos) {
  return fenOf(pos).split(' ').slice(0, 4).join(' ');
}

// repetitionCounts: Map of repetitionKey → times the position has occurred, including the current one.
export function endState(pos, repetitionCounts) {
  if (pos.isCheckmate()) {
    return { result: pos.turn === 'white' ? '0-1' : '1-0', termination: 'checkmate' };
  }
  if (pos.isStalemate()) return { result: '1/2-1/2', termination: 'stalemate' };
  if (pos.isInsufficientMaterial()) return { result: '1/2-1/2', termination: 'insufficient' };
  if ((repetitionCounts?.get(repetitionKey(pos)) ?? 0) >= 3) {
    return { result: '1/2-1/2', termination: 'repetition' };
  }
  if (pos.halfmoves >= 100) return { result: '1/2-1/2', termination: 'fiftyMove' };
  return null;
}

// Stockfish expects standard castling as the king's move (e1g1), not king-takes-rook (e1h1).
// `pos` is the position before the move; `move` is a chessops move or UCI string.
export function uciForEngine(pos, move, variant) {
  const parsed = typeof move === 'string' ? parseUci(move) : move;
  if (!parsed) return null;
  if (variant === 'chess960') return makeUci(parsed);
  const side = castlingSide(pos, parsed);
  if (side && pos.board[pos.turn].has(parsed.to)) {
    const rankStart = parsed.from - squareFile(parsed.from);
    return makeUci({ from: parsed.from, to: rankStart + (side === 'h' ? 6 : 2) });
  }
  return makeUci(parsed);
}

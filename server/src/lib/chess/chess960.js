// Mirrored in client/src/lib/chess/chess960.js and server/src/lib/chess/chess960.js — keep both copies identical.

const KNIGHT_PAIRS = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];

// Back rank for Scharnagl number n (0–959), as 8 uppercase letters from the a-file. 518 is the standard setup.
export function chess960BackRank(n) {
  if (!Number.isInteger(n) || n < 0 || n > 959) throw new Error('Chess960 position number must be 0–959');
  const rank = Array(8).fill(null);
  const emptyFiles = () => rank.flatMap((piece, file) => (piece ? [] : [file]));

  rank[[1, 3, 5, 7][n % 4]] = 'B'; // light-squared bishop
  n = Math.floor(n / 4);
  rank[[0, 2, 4, 6][n % 4]] = 'B'; // dark-squared bishop
  n = Math.floor(n / 4);
  rank[emptyFiles()[n % 6]] = 'Q';
  n = Math.floor(n / 6);
  const [first, second] = KNIGHT_PAIRS[n];
  const forKnights = emptyFiles();
  rank[forKnights[first]] = 'N';
  rank[forKnights[second]] = 'N';
  const [rookA, king, rookB] = emptyFiles();
  rank[rookA] = 'R';
  rank[king] = 'K';
  rank[rookB] = 'R';
  return rank.join('');
}

// Castling is written as KQkq: with only two rooks, each is the outermost on its side, which is also how
// chessops writes these positions, so the FEN round-trips unchanged.
export function chess960Fen(n) {
  const white = chess960BackRank(n);
  return `${white.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

export function randomChess960Fen() {
  return chess960Fen(Math.floor(Math.random() * 960));
}

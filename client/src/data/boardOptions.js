// Piece sets live in public/pieces/<id>/<wK|bQ|...>.svg (see README for credits).
export const PIECE_SETS = [
  { id: 'cburnett', name: 'Classic' },
  { id: 'merida', name: 'Merida' },
  { id: 'staunty', name: 'Staunty' },
  { id: 'california', name: 'California' },
  { id: 'chessnut', name: 'Chessnut' },
  { id: 'fantasy', name: 'Fantasy' },
];

export const BOARD_THEMES = [
  { id: 'walnut', name: 'Walnut', light: '#ecd9b9', dark: '#a87a55' },
  { id: 'sand', name: 'Sand', light: '#f3e7cf', dark: '#c9a36b' },
  { id: 'slate', name: 'Slate', light: '#dfe4e8', dark: '#7d8fa0' },
  { id: 'lagoon', name: 'Lagoon', light: '#d8e6e3', dark: '#5f8f93' },
  { id: 'rose', name: 'Rose', light: '#f0dfdf', dark: '#b77b83' },
  { id: 'graphite', name: 'Graphite', light: '#cfcfd1', dark: '#6e6e73' },
];

export const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

export function pieceUrl(setId, code) {
  return `/pieces/${setId}/${code}.svg`;
}

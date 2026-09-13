// Mirrored in client/src/shared/avatars.js and server/src/shared/avatars.js — keep both copies identical.

// Pieces always come from the cburnett set, whatever set the user picked for the board.
export const AVATARS = [
  { id: 'king-parchment', piece: 'wK', bg: '#e6d2a6' },
  { id: 'queen-walnut', piece: 'wQ', bg: '#a87a55' },
  { id: 'rook-umber', piece: 'wR', bg: '#5a3712' },
  { id: 'bishop-lagoon', piece: 'wB', bg: '#5f8f93' },
  { id: 'knight-rose', piece: 'wN', bg: '#b77b83' },
  { id: 'pawn-slate', piece: 'wP', bg: '#7d8fa0' },
  { id: 'king-sand', piece: 'bK', bg: '#f3e7cf' },
  { id: 'queen-mist', piece: 'bQ', bg: '#dfe4e8' },
  { id: 'knight-sage', piece: 'bN', bg: '#d8e6e3' },
  { id: 'rook-stone', piece: 'bR', bg: '#cfcfd1' },
];

export function isAvatarId(id) {
  return AVATARS.some((avatar) => avatar.id === id);
}

export function randomAvatarId() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
}

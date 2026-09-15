// Mirrored in client/src/shared/lessonIds.js and server/src/shared/lessonIds.js — keep both copies identical.

// Every lesson, in the order the Learn page lists them (client/src/data/lessons/index.js).
export const LESSON_IDS = [
  'pawn',
  'knight',
  'bishop',
  'rook',
  'queen',
  'king',
  'check',
  'castling',
  'en-passant',
  'promotion',
  'back-rank',
  'smothered-mate',
  'two-rook-ladder',
  'queen-mate',
  'fork',
  'pin',
  'skewer',
  'discovered-attack',
];

export function isLessonId(id) {
  return LESSON_IDS.includes(id);
}

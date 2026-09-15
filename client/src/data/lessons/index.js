import backRank from './back-rank.js';
import bishop from './bishop.js';
import castling from './castling.js';
import check from './check.js';
import discoveredAttack from './discovered-attack.js';
import enPassant from './en-passant.js';
import fork from './fork.js';
import king from './king.js';
import knight from './knight.js';
import pawn from './pawn.js';
import pin from './pin.js';
import promotion from './promotion.js';
import queenMate from './queen-mate.js';
import queen from './queen.js';
import rook from './rook.js';
import skewer from './skewer.js';
import smotheredMate from './smothered-mate.js';
import twoRookLadder from './two-rook-ladder.js';

// Lesson groups in the order the Learn page shows them. Keep shared/lessonIds.js in the same order.
export const LESSON_GROUPS = [
  {
    id: 'rules',
    title: 'Rules of the game',
    summary: 'How every piece moves, plus the special moves.',
    lessons: [pawn, knight, bishop, rook, queen, king, check, castling, enPassant, promotion],
  },
  {
    id: 'mates',
    title: 'Checkmate patterns',
    summary: 'Classic ways to finish the game.',
    lessons: [backRank, smotheredMate, twoRookLadder, queenMate],
  },
  {
    id: 'tactics',
    title: 'Tactics',
    summary: 'Tricks that win material.',
    lessons: [fork, pin, skewer, discoveredAttack],
  },
];

export const LESSONS = LESSON_GROUPS.flatMap((group) => group.lessons);

export function lessonById(id) {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}

// The lesson after this one across all groups, or null for the last.
export function nextLesson(id) {
  const index = LESSONS.findIndex((lesson) => lesson.id === id);
  return index === -1 ? null : (LESSONS[index + 1] ?? null);
}

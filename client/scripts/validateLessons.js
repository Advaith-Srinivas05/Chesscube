// npm run lessons:check — checks every lesson in src/data/lessons. Exits non-zero on any problem.
import { makeUci, squareRank } from 'chessops/util';
import { LESSON_GROUPS } from '../src/data/lessons/index.js';
import { fenOf, parseMove, positionFromFen } from '../src/lib/chess/rules.js';
import { GOAL_TYPES, piecesLeft, playStepMove, startStep } from '../src/lib/lessons.js';
import { LESSON_IDS } from '../src/shared/lessonIds.js';

const MAX_NODES = 200_000;
const SQUARE = /^[a-h][1-8]$/;

function legalUcis(pos) {
  const moves = [];
  for (const [from, dests] of pos.allDests()) {
    const isPawn = pos.board.pawn.has(from);
    for (const to of dests) {
      const promotes = isPawn && (squareRank(to) === 0 || squareRank(to) === 7);
      moves.push(makeUci({ from, to, ...(promotes ? { promotion: 'queen' } : {}) }));
    }
  }
  return moves;
}

const cloneState = (state) => ({ ...state, pos: state.pos.clone(), reached: new Set(state.reached) });

// Breadth-first search over the player's moves (the turn comes back after each one) for a finished drill.
function solveDrill(step, maxDepth) {
  let frontier = [startStep(step)];
  const seen = new Set();
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const state of frontier) {
      for (const uci of legalUcis(state.pos)) {
        const copy = cloneState(state);
        const result = playStepMove(step, copy, uci);
        if (result.verdict !== 'ok') continue;
        if (result.done) return depth;
        const key = `${fenOf(copy.pos)}|${[...copy.reached].sort().join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(copy);
        if (seen.size > MAX_NODES) return null;
      }
    }
    frontier = next;
  }
  return null;
}

function checkStep(step) {
  const problems = [];
  if (typeof step.text !== 'string' || !step.text.trim()) problems.push('missing text');
  const { goal } = step;
  if (!goal || !GOAL_TYPES.includes(goal.type)) return [...problems, `unknown goal type ${goal?.type}`];

  let pos;
  try {
    pos = positionFromFen(step.fen);
  } catch (error) {
    return [...problems, error.message];
  }
  // Not isEnd(): drills often have insufficient material on purpose.
  if (pos.isCheckmate() || pos.isStalemate()) return [...problems, 'the position has no legal moves'];

  switch (goal.type) {
    case 'reach': {
      if (!Array.isArray(goal.targets) || goal.targets.length === 0 || !goal.targets.every((s) => SQUARE.test(s))) {
        problems.push('reach needs a list of target squares');
        break;
      }
      if (solveDrill(step, goal.targets.length * 4) === null) problems.push('the targets cannot all be reached');
      break;
    }
    case 'captureAll': {
      const pieces = piecesLeft(pos, pos.turn === 'white' ? 'black' : 'white');
      if (pieces === 0) problems.push('there is nothing to capture');
      else if (solveDrill(step, pieces * 4) === null) problems.push('the pieces cannot all be captured');
      break;
    }
    case 'mate': {
      const mates = legalUcis(pos).some((uci) => {
        const after = pos.clone();
        after.play(parseMove(after, uci));
        return after.isCheckmate();
      });
      if (!mates) problems.push('no move gives checkmate');
      break;
    }
    case 'line': {
      if (!Array.isArray(goal.moves) || goal.moves.length % 2 === 0) {
        problems.push('line needs an odd number of moves (it ends with the player’s move)');
        break;
      }
      const line = pos.clone();
      goal.moves.forEach((uci, index) => {
        if (problems.length) return;
        const move = parseMove(line, uci);
        if (!move) problems.push(`move ${index + 1} (${uci}) is illegal`);
        else line.play(move);
      });
      break;
    }
    case 'move': {
      if (!Array.isArray(goal.moves) || goal.moves.length === 0) problems.push('move needs a list of moves');
      else for (const uci of goal.moves) if (!parseMove(pos, uci)) problems.push(`${uci} is illegal`);
      break;
    }
  }
  return problems;
}

let failures = 0;
let count = 0;
const ids = new Set();

for (const group of LESSON_GROUPS) {
  for (const lesson of group.lessons) {
    count += 1;
    const report = (message) => {
      failures += 1;
      console.error(`✗ ${lesson.id ?? '(no id)'}: ${message}`);
    };
    if (!lesson.id || ids.has(lesson.id)) report('missing or duplicate id');
    ids.add(lesson.id);
    if (lesson.group !== group.id) report(`group is "${lesson.group}", listed under "${group.id}"`);
    if (!lesson.title || !lesson.summary) report('missing title or summary');
    if (!Array.isArray(lesson.steps) || lesson.steps.length === 0) {
      report('no steps');
      continue;
    }
    lesson.steps.forEach((step, index) => {
      for (const problem of checkStep(step)) report(`step ${index + 1}: ${problem}`);
    });
  }
}

// The server only accepts ids in shared/lessonIds.js, so it must list exactly these lessons, in order.
const listed = LESSON_GROUPS.flatMap((group) => group.lessons.map((lesson) => lesson.id));
if (listed.join() !== LESSON_IDS.join()) {
  failures += 1;
  console.error(`✗ shared/lessonIds.js doesn't match data/lessons/index.js:\n  ids:   ${LESSON_IDS.join(', ')}\n  index: ${listed.join(', ')}`);
}

if (failures) {
  console.error(`\n${failures} problem${failures === 1 ? '' : 's'} in ${count} lesson${count === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`✓ ${count} lesson${count === 1 ? '' : 's'} OK`);

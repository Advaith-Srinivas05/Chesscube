import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { INITIAL_FEN } from 'chessops/fen';
import { ChildNode, emptyHeaders, makePgn, Node, parsePgn, parseVariant, startingPosition } from 'chessops/pgn';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { makeSquare, makeUci, squareFile, squareRank } from 'chessops/util';
import { useSettings } from '../context/SettingsContext.jsx';
import { applyMove, fenOf, legalDests, parseMove, positionFromFen } from '../lib/chess/rules.js';
import { moveSound, playSound } from '../lib/sounds.js';

const ENGINE_DEPTH = 18;
const ENGINE_LINES = 3;
const DEBOUNCE_MS = 150;
const FLUSH_MS = 100;
const PV_PLIES = 12;

// Castling that standard chess can't express (king off the e-file, or a castling rook off the a/h files)
// means the position comes from Chess960.
export function detectVariant(pos) {
  for (const rook of pos.castles.castlingRights) {
    const rank = squareRank(rook);
    const king = pos.board.kingOf(rank === 0 ? 'white' : 'black');
    if (squareFile(rook) % 7 !== 0 || king === undefined || squareFile(king) !== 4) return 'chess960';
  }
  return 'standard';
}

let nextId = 1;

function makeNode(parent, pos, move) {
  const moveNumber = pos.fullmoves;
  const color = pos.turn;
  const san = makeSanAndPlay(pos, move);
  const node = { id: nextId++, parent, uci: makeUci(move), san, fen: fenOf(pos), moveNumber, color, children: [] };
  parent.children.push(node);
  return node;
}

function createTree(fen) {
  return { id: 0, parent: null, uci: null, san: null, fen, children: [] };
}

// The tree and where we are in it. Throws with a readable message when the input doesn't load.
function buildFromMoves({ variant, fen, moves = [] }) {
  let pos;
  try {
    pos = positionFromFen(fen || INITIAL_FEN);
  } catch (error) {
    throw new Error(error.message.startsWith('Invalid FEN') ? "That isn't a valid FEN" : error.message);
  }
  const root = createTree(fenOf(pos));
  const resolvedVariant = variant === 'chess960' ? 'chess960' : detectVariant(pos);
  let node = root;
  for (const uci of moves) {
    const before = positionFromFen(node.fen);
    const move = parseMove(before, uci, resolvedVariant);
    if (!move) break;
    node = makeNode(node, before, move);
  }
  return { root, current: node, variant: resolvedVariant };
}

function buildFromPgn(text) {
  const [game] = parsePgn(String(text ?? ''));
  const hasMoves = game?.moves.children.length > 0;
  if (!game || (!hasMoves && !game.headers.has('FEN'))) throw new Error('No moves found in that PGN');

  const variantHeader = game.headers.get('Variant');
  if (parseVariant(variantHeader) !== 'chess') throw new Error('Only standard chess and Chess960 are supported');
  const start = startingPosition(game.headers);
  if (start.isErr) throw new Error('The PGN has an invalid starting position');

  const root = createTree(fenOf(start.value));
  let illegal = null;
  const addChildren = (ours, theirs, pos) => {
    for (const child of theirs.children) {
      const copy = pos.clone();
      const move = parseSan(copy, child.data.san);
      if (!move) {
        illegal ??= `${pos.fullmoves}${pos.turn === 'white' ? '.' : '...'} ${child.data.san}`;
        continue;
      }
      addChildren(makeNode(ours, copy, move), child, copy);
    }
  };
  addChildren(root, game.moves, start.value);
  if (hasMoves && root.children.length === 0) throw new Error(`The first move (${illegal}) is illegal`);

  const variant = /960|fischer/i.test(variantHeader ?? '') ? 'chess960' : detectVariant(start.value);
  return { root, current: root, variant, warning: illegal && `Stopped at an illegal move: ${illegal}` };
}

function lineEnd(node) {
  let end = node;
  while (end.children.length) [end] = end.children;
  return end;
}

// True when some node on the way from the root is not its parent's first child.
function inVariation(node) {
  for (let step = node; step.parent; step = step.parent) {
    if (step.parent.children[0] !== step) return true;
  }
  return false;
}

function checkSquare(pos) {
  if (!pos.isCheck()) return null;
  const king = pos.board.kingOf(pos.turn);
  return king === undefined ? null : makeSquare(king);
}

/**
 * Analysis board state: a tree of moves (first child = main line) and the node on the board.
 * `initial` is { variant, fen, moves } or { pgn }; it's read once. Mount a new component to start over.
 */
export default function useAnalysis(initial) {
  const { settings } = useSettings();
  const [state] = useState(() => {
    try {
      return { ...(initial?.pgn ? buildFromPgn(initial.pgn) : buildFromMoves(initial ?? {})), error: null };
    } catch (error) {
      return { ...buildFromMoves({}), error: error.message };
    }
  });
  const [version, bump] = useReducer((n) => n + 1, 0);
  const soundRef = useRef(settings);
  soundRef.current = settings;

  const goTo = useCallback((node) => {
    if (!node || node === state.current) return;
    state.current = node;
    bump();
  }, [state]);

  const navigate = useCallback(
    (action) => {
      const node = state.current;
      const target = {
        first: state.root,
        prev: node.parent,
        next: node.children[0],
        last: lineEnd(node),
      }[action];
      goTo(target);
    },
    [state, goTo]
  );

  // Plays a UCI move from the current node, reusing an existing child for the same move.
  const play = useCallback(
    (uci) => {
      const node = state.current;
      const pos = positionFromFen(node.fen);
      const move = parseMove(pos, uci, state.variant);
      if (!move) return false;
      const existing = node.children.find((child) => child.uci === makeUci(move));
      state.current = existing ?? makeNode(node, pos, move);
      if (soundRef.current.sounds) playSound(moveSound(state.current.san), soundRef.current.soundTheme);
      bump();
      return true;
    },
    [state]
  );

  const load = useCallback(
    (input) => {
      const next = input.pgn ? buildFromPgn(input.pgn) : buildFromMoves(input);
      Object.assign(state, next, { error: null });
      bump();
      return next.warning ?? null;
    },
    [state]
  );

  // Moves the variation containing the current node one step closer to the main line.
  const promote = useCallback(() => {
    let step = state.current;
    while (step.parent && step.parent.children[0] === step) step = step.parent;
    if (!step.parent) return;
    const siblings = step.parent.children;
    siblings.splice(siblings.indexOf(step), 1);
    siblings.unshift(step);
    bump();
  }, [state]);

  // Deletes the current move and everything after it.
  const remove = useCallback(() => {
    const node = state.current;
    if (!node.parent) return;
    node.parent.children.splice(node.parent.children.indexOf(node), 1);
    state.current = node.parent;
    bump();
  }, [state]);

  const exportPgn = useCallback(() => {
    const headers = emptyHeaders();
    if (state.variant === 'chess960') headers.set('Variant', 'Chess960');
    if (state.variant === 'chess960' || state.root.fen !== INITIAL_FEN) {
      headers.set('SetUp', '1');
      headers.set('FEN', state.root.fen);
    }
    const convert = (ours, theirs) => {
      for (const child of ours.children) {
        const node = new ChildNode({ san: child.san });
        theirs.children.push(node);
        convert(child, node);
      }
    };
    const moves = new Node();
    convert(state.root, moves);
    return makePgn({ headers, moves }).trim();
  }, [state]);

  const view = useMemo(() => {
    const node = state.current;
    const pos = positionFromFen(node.fen);
    return {
      pos,
      fen: node.fen,
      turn: pos.turn,
      lastMove: node.uci ? [node.uci.slice(0, 2), node.uci.slice(2, 4)] : null,
      check: checkSquare(pos),
      dests: legalDests(pos, state.variant),
    };
  }, [version, state]);

  return {
    ...view,
    version,
    root: state.root,
    current: state.current,
    variant: state.variant,
    error: state.error,
    isStart: !state.current.parent,
    isEnd: state.current.children.length === 0,
    inVariation: inVariation(state.current),
    goTo,
    navigate,
    play,
    load,
    promote,
    remove,
    exportPgn,
  };
}

// White's point of view: positive is good for White. Stockfish reports scores for the side to move.
function whiteScore(score, turn) {
  const sign = turn === 'white' ? 1 : -1;
  return 'mate' in score ? { mate: score.mate * sign } : { cp: score.cp * sign };
}

// SAN moves with numbers for an engine line, stopping at the first move that doesn't parse.
function pvToSan(fen, pv, variant) {
  const pos = positionFromFen(fen);
  const moves = [];
  for (const uci of pv.slice(0, PV_PLIES)) {
    const moveNumber = pos.fullmoves;
    const color = pos.turn;
    const played = applyMove(pos, uci, variant);
    if (!played) break;
    moves.push({ uci: played.uci, san: played.san, moveNumber, color });
  }
  return moves;
}

/**
 * Live Stockfish lines for a position: [{ multipv, depth, score (White's view), moves }].
 * `over` is set for positions with no legal moves: { mate: 0, winner } or { stalemate: true }.
 */
export function useEngineLines({ engine, fen, variant, enabled }) {
  const [ready, setReady] = useState(false);
  const [lines, setLines] = useState([]);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!engine) return undefined;
    let active = true;
    engine.ready().then(() => active && setReady(true)).catch(() => {});
    return () => {
      active = false;
    };
  }, [engine]);

  useEffect(() => {
    if (engine) engine.setOption('UCI_Chess960', variant === 'chess960').catch(() => {});
  }, [engine, variant]);

  const over = useMemo(() => {
    const pos = positionFromFen(fen);
    if (pos.isCheckmate()) return { winner: pos.turn === 'white' ? 'black' : 'white' };
    if (pos.isStalemate() || pos.isInsufficientMaterial()) return { draw: true };
    return null;
  }, [fen]);

  useEffect(() => {
    setLines([]);
    if (!engine || !enabled || !visible || over) {
      engine?.stop();
      return undefined;
    }

    const turn = positionFromFen(fen).turn;
    const latest = new Map();
    let stopSearch = null;
    let flushTimer = null;
    let cancelled = false;

    const flush = () => {
      flushTimer = null;
      if (!cancelled) setLines([...latest.values()].sort((a, b) => a.multipv - b.multipv));
    };

    const start = setTimeout(() => {
      stopSearch = engine.analyse({ fen, depth: ENGINE_DEPTH, multipv: ENGINE_LINES }, (info) => {
        if (cancelled) return;
        const moves = pvToSan(fen, info.pv, variant);
        latest.set(info.multipv, {
          multipv: info.multipv,
          depth: info.depth,
          score: whiteScore(info.score, turn),
          moves,
          // The engine's own notation for the first move: standard castling stays e1g1, so an arrow points at the king's square.
          bestUci: moves.length ? info.pv[0] : null,
        });
        flushTimer ??= setTimeout(flush, FLUSH_MS);
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(start);
      clearTimeout(flushTimer);
      stopSearch?.();
    };
  }, [engine, fen, variant, enabled, visible, over]);

  return { ready, lines, over, maxDepth: ENGINE_DEPTH };
}

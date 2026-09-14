import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { INITIAL_FEN } from 'chessops/fen';
import { makeSquare, opposite } from 'chessops/util';
import { useSettings } from '../context/SettingsContext.jsx';
import { COMPUTER_LEVELS } from '../data/computerGame.js';
import { randomChess960Fen } from '../lib/chess/chess960.js';
import {
  applyMove,
  endState,
  fenOf,
  legalDests,
  parseMove,
  positionFromFen,
  repetitionKey,
} from '../lib/chess/rules.js';
import { moveSound, playSound } from '../lib/sounds.js';

const MIN_REPLY_MS = 300;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createGame({ variant, color, tc }) {
  const startFen = variant === 'chess960' ? randomChess960Fen() : INITIAL_FEN;
  const pos = positionFromFen(startFen);
  return {
    startFen,
    pos,
    playerColor: color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color,
    moves: [], // [{ uci, san, fen }]
    counts: new Map([[repetitionKey(pos), 1]]),
    status: 'playing', // 'playing' | 'ended'
    result: null, // '1-0' | '0-1' | '1/2-1/2' | null when aborted
    termination: null,
    clocks: tc ? { white: tc.base * 1000, black: tc.base * 1000 } : null,
    syncedAt: null, // performance.now() when `clocks` were last brought up to date
    premove: null, // { from, to, promotion? }
  };
}

function checkSquare(pos) {
  if (!pos.isCheck()) return null;
  const king = pos.board.kingOf(pos.turn);
  return king === undefined ? null : makeSquare(king);
}

/**
 * Local game against Stockfish. `engine` comes from createEngine() and may be null while loading.
 * The game lives in one mutable object; `version` re-renders after each change.
 * Mount a fresh component (new key) for a new game.
 */
export default function useComputerGame({ engine, level, variant, color, tc }) {
  const { settings } = useSettings();
  const [game] = useState(() => createGame({ variant, color, tc }));
  const [version, bump] = useReducer((n) => n + 1, 0);
  const [viewPly, setViewPly] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const soundRef = useRef(settings);
  soundRef.current = settings;

  const sound = useCallback((type) => {
    if (soundRef.current.sounds) playSound(type, soundRef.current.soundTheme);
  }, []);

  // Clocks run once both sides have made their first move.
  const clocksRunning = () => Boolean(game.clocks) && game.status === 'playing' && game.moves.length >= 2;

  const finish = useCallback(
    (result, termination) => {
      if (game.status !== 'playing') return;
      if (clocksRunning()) {
        const now = performance.now();
        game.clocks[game.pos.turn] = Math.max(0, game.clocks[game.pos.turn] - (now - game.syncedAt));
        game.syncedAt = now;
      }
      game.status = 'ended';
      game.result = result;
      game.termination = termination;
      game.premove = null;
      engine?.stop();
      bump();
    },
    [engine]
  );

  // Plays a UCI move for whichever side is to move. Returns false when it's illegal.
  const play = useCallback(
    (uci) => {
      if (game.status !== 'playing') return false;
      const mover = game.pos.turn;
      const played = applyMove(game.pos, uci, variant);
      if (!played) return false;

      if (game.clocks) {
        const now = performance.now();
        if (game.moves.length >= 2) {
          game.clocks[mover] = Math.max(0, game.clocks[mover] - (now - game.syncedAt)) + tc.inc * 1000;
        }
        game.syncedAt = now;
      }

      game.moves.push(played);
      const key = repetitionKey(game.pos);
      game.counts.set(key, (game.counts.get(key) ?? 0) + 1);
      sound(moveSound(played.san));

      const total = game.moves.length;
      setViewPly((current) => (current === total - 1 ? total : current));
      const end = endState(game.pos, game.counts);
      if (end) finish(end.result, end.termination);
      bump();
      return true;
    },
    [variant, tc, sound, finish]
  );

  // Engine setup for this game.
  useEffect(() => {
    if (!engine) return undefined;
    let active = true;
    setEngineReady(false);
    engine
      .setOption('UCI_Chess960', variant === 'chess960')
      .then(() => engine.newGame())
      .then(() => active && setEngineReady(true))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [engine, variant]);

  // The engine's turn.
  const plies = game.moves.length;
  useEffect(() => {
    if (!engineReady || game.status !== 'playing' || game.pos.turn === game.playerColor) return undefined;
    let cancelled = false;

    (async () => {
      const { depth, skill, movetime: cap } = COMPUTER_LEVELS.find((entry) => entry.level === level) ?? COMPUTER_LEVELS[2];
      let movetime = cap;
      if (clocksRunning()) {
        const left = game.clocks[game.pos.turn] - (performance.now() - game.syncedAt);
        movetime = Math.max(30, Math.min(cap, Math.floor(left / 40)));
      }
      const requestedAt = performance.now();
      const move = await engine.bestMove({ fen: fenOf(game.pos), depth, movetime, skill });
      const wait = MIN_REPLY_MS - (performance.now() - requestedAt);
      if (wait > 0) await sleep(wait);
      if (cancelled || game.status !== 'playing' || game.moves.length !== plies || !move) return;
      if (!play(move)) return;

      // Only one premove at a time: play it now if it's legal, otherwise drop it silently.
      const premove = game.premove;
      if (!premove) return;
      game.premove = null;
      const uci = `${premove.from}${premove.to}${premove.promotion ?? ''}`;
      if (game.status !== 'playing' || !parseMove(game.pos, uci, variant) || !play(uci)) bump();
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [engineReady, plies, game.status]);

  // Flag: end the game when the side to move runs out of time.
  useEffect(() => {
    if (!clocksRunning()) return undefined;
    const turn = game.pos.turn;
    const left = game.clocks[turn] - (performance.now() - game.syncedAt);
    const timer = setTimeout(() => {
      if (game.status !== 'playing' || game.pos.turn !== turn) return;
      game.clocks[turn] = 0;
      game.syncedAt = performance.now();
      const winner = opposite(turn);
      const drawn = game.pos.hasInsufficientMaterial(winner);
      finish(drawn ? '1/2-1/2' : winner === 'white' ? '1-0' : '0-1', 'timeout');
    }, Math.max(0, left));
    return () => clearTimeout(timer);
  }, [version]);

  // Turning premoves off in settings clears a pending one.
  useEffect(() => {
    if (!settings.premoves && game.premove) {
      game.premove = null;
      bump();
    }
  }, [settings.premoves, game]);

  const move = useCallback(
    ({ from, to, promotion }) => {
      if (game.status !== 'playing' || game.pos.turn !== game.playerColor) return false;
      return play(`${from}${to}${promotion ?? ''}`);
    },
    [game, play]
  );

  const setPremove = useCallback(
    (premove) => {
      if (game.status !== 'playing' || game.pos.turn === game.playerColor) return;
      game.premove = premove;
      bump();
    },
    [game]
  );

  const cancelPremove = useCallback(() => {
    if (!game.premove) return;
    game.premove = null;
    bump();
  }, [game]);

  const resign = useCallback(() => finish(game.playerColor === 'white' ? '0-1' : '1-0', 'resign'), [game, finish]);
  const abort = useCallback(() => finish(null, 'abort'), [finish]);

  const latest = game.moves.length;
  const shownPly = Math.min(viewPly, latest);
  const atLatest = shownPly === latest;

  const view = useMemo(() => {
    const fen = shownPly === 0 ? game.startFen : game.moves[shownPly - 1].fen;
    const uci = shownPly === 0 ? null : game.moves[shownPly - 1].uci;
    const pos = shownPly === latest ? game.pos : positionFromFen(fen);
    return {
      fen,
      lastMove: uci ? [uci.slice(0, 2), uci.slice(2, 4)] : null,
      check: checkSquare(pos),
      turn: pos.turn,
    };
  }, [shownPly, latest, version]);

  const playerToMove = game.status === 'playing' && game.pos.turn === game.playerColor;
  const dests = useMemo(
    () => (playerToMove && atLatest ? legalDests(game.pos, variant) : new Map()),
    [playerToMove, atLatest, version, variant]
  );

  return {
    startFen: game.startFen,
    playerColor: game.playerColor,
    moves: game.moves,
    fen: view.fen,
    lastMove: view.lastMove,
    check: view.check,
    turn: view.turn,
    dests,
    viewPly: shownPly,
    atLatest,
    setViewPly,
    status: game.status,
    result: game.result,
    termination: game.termination,
    clocks: game.clocks ? { ...game.clocks } : null,
    clockColor: clocksRunning() ? game.pos.turn : null,
    syncedAt: game.syncedAt,
    premove: game.premove,
    engineReady,
    thinking: engineReady && game.status === 'playing' && game.pos.turn !== game.playerColor,
    canAbort: game.status === 'playing' && latest < 2,
    move,
    setPremove,
    cancelPremove,
    resign,
    abort,
  };
}

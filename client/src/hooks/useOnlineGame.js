import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INITIAL_FEN } from 'chessops/fen';
import { makeSquare, opposite } from 'chessops/util';
import { useToast } from '../components/ui/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { applyMove, legalDests, parseMove, positionFromFen } from '../lib/chess/rules.js';
import { request, socket } from '../lib/socket.js';
import { moveSound, playSound } from '../lib/sounds.js';
import useSocket from './useSocket.js';
import useSocketEvent from './useSocketEvent.js';

function checkSquare(pos) {
  if (!pos.isCheck()) return null;
  const king = pos.board.kingOf(pos.turn);
  return king === undefined ? null : makeSquare(king);
}

const clocksRunning = (game) => game.status === 'playing' && game.moves.length >= 2;

// Server times (ms) → this browser's Date.now() scale.
const toLocal = (game, serverTime) => (serverTime == null ? null : serverTime - game.serverOffset);

// Brings the clocks up to date from a snapshot or move event: time already spent on the running clock is subtracted.
function syncClocks(game, { clock, turnStartedAt, serverNow }) {
  game.serverOffset = serverNow - Date.now();
  game.clock = { ...clock };
  if (clocksRunning(game)) {
    game.clock[game.pos.turn] = Math.max(0, clock[game.pos.turn] - (serverNow - turnStartedAt));
  }
  game.syncedAt = performance.now();
}

function buildGame(snapshot, role) {
  const startFen = snapshot.initialFen ?? INITIAL_FEN;
  const pos = positionFromFen(startFen);
  const moves = [];
  for (const { uci } of snapshot.moves) {
    const played = applyMove(pos, uci, snapshot.variant);
    if (!played) break;
    moves.push(played);
  }
  const game = {
    id: snapshot.id,
    variant: snapshot.variant,
    tc: snapshot.tc,
    rated: snapshot.rated,
    category: snapshot.category,
    players: { white: snapshot.white, black: snapshot.black },
    role,
    startFen,
    pos,
    moves, // [{ uci, san, fen }]
    status: snapshot.status,
    result: snapshot.result,
    termination: snapshot.termination,
    ratingDiffs: snapshot.ratingDiffs,
    drawOffer: snapshot.drawOffer,
    drawOffersLeft: snapshot.drawOffersLeft,
    rematchOffer: snapshot.rematchOffer,
    premove: null,
    clock: null,
    syncedAt: null,
    serverOffset: 0,
  };
  syncClocks(game, snapshot);
  game.firstMoveDeadline = toLocal(game, snapshot.firstMoveDeadline);
  game.claimAt = { white: toLocal(game, snapshot.gone.white), black: toLocal(game, snapshot.gone.black) };
  return game;
}

/**
 * A live game on the server, for one of its players. state: 'loading' | 'live' | 'unavailable'
 * (not in memory or not a player: the page falls back to the stored game). Own moves are applied
 * optimistically; a rejected move re-joins for a fresh snapshot.
 */
export default function useOnlineGame(id) {
  const { settings } = useSettings();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { connected } = useSocket();
  const [state, setState] = useState({ phase: 'loading', code: null });
  const gameRef = useRef(null);
  const [version, bump] = useReducer((n) => n + 1, 0);
  const [viewPly, setViewPly] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const sound = useCallback((type) => {
    if (settingsRef.current.sounds) playSound(type, settingsRef.current.soundTheme);
  }, []);

  const join = useCallback(async () => {
    const response = await request('game:join', { id });
    if (!response.ok) {
      gameRef.current = null;
      setState({ phase: 'unavailable', code: response.code ?? null, message: response.message });
      return;
    }
    const game = buildGame(response.snapshot, response.role);
    gameRef.current = game;
    setViewPly(game.moves.length);
    setState({ phase: 'live', code: null });
    bump();
  }, [id]);

  // (Re)join whenever the connection is up; leaving the page doesn't resign, it only lets go of the game.
  useEffect(() => {
    if (!connected) return undefined;
    join();
    return () => {
      // A dropped connection already counts as leaving; a queued leave would only arrive after rejoining.
      if (socket.connected) request('game:leave', { id });
    };
  }, [connected, join, id]);

  // Follow new moves unless the player is looking back through the game.
  const pushMove = (game, played) => {
    game.moves.push(played);
    const total = game.moves.length;
    setViewPly((current) => (current === total - 1 ? total : current));
    sound(moveSound(played.san));
  };

  const sendMove = useCallback(
    (uci) => {
      const game = gameRef.current;
      if (!game || game.status !== 'playing' || game.pos.turn !== game.role) return false;
      const ply = game.moves.length;
      const running = clocksRunning(game);
      const played = applyMove(game.pos, uci, game.variant);
      if (!played) return false;

      const now = performance.now();
      if (running) game.clock[game.role] = Math.max(0, game.clock[game.role] - (now - game.syncedAt)) + game.tc.inc * 1000;
      game.syncedAt = now;
      if (game.drawOffer === opposite(game.role)) game.drawOffer = null;
      pushMove(game, played);
      bump();

      request('game:move', { id, uci: played.uci, ply }).then((response) => {
        if (response.ok) return;
        if (response.code !== 'STALE') toast.show(response.message, { tone: 'danger' });
        join();
      });
      return true;
    },
    [id, join, toast]
  );

  // Only one premove at a time: play it when the turn comes back if it's legal, otherwise drop it.
  const runPremove = (game) => {
    const premove = game.premove;
    if (!premove || game.status !== 'playing' || game.pos.turn !== game.role) return;
    game.premove = null;
    const uci = `${premove.from}${premove.to}${premove.promotion ?? ''}`;
    if (!parseMove(game.pos, uci, game.variant) || !sendMove(uci)) bump();
  };

  const current = (data) => (data?.id === id ? gameRef.current : null);

  useSocketEvent('game:move', (data) => {
    const game = current(data);
    if (!game) return;
    if (data.ply === game.moves.length) {
      const played = applyMove(game.pos, data.uci, game.variant);
      if (!played) return join();
      pushMove(game, played);
    } else if (data.ply !== game.moves.length - 1 || game.moves[data.ply].uci !== data.uci) {
      return join(); // missed something
    }
    syncClocks(game, data);
    game.drawOffer = data.drawOffer;
    game.firstMoveDeadline = toLocal(game, data.firstMoveDeadline);
    bump();
    runPremove(game);
  });

  useSocketEvent('game:end', (data) => {
    const game = current(data);
    if (!game) return;
    game.status = 'ended';
    game.result = data.result;
    game.termination = data.termination;
    game.clock = { ...data.clock };
    game.syncedAt = performance.now();
    game.ratingDiffs = data.ratingDiffs;
    game.drawOffer = null;
    game.premove = null;
    game.firstMoveDeadline = null;
    bump();
    if (data.ratingDiffs && user) refresh();
  });

  useSocketEvent('game:drawOffer', (data) => {
    const game = current(data);
    if (!game) return;
    game.drawOffer = data.color;
    game.drawOffersLeft = { ...game.drawOffersLeft, [data.color]: game.drawOffersLeft[data.color] - 1 };
    bump();
  });

  useSocketEvent('game:drawDeclined', (data) => {
    const game = current(data);
    if (!game) return;
    game.drawOffer = null;
    if (data.color === game.role) toast.show('Your draw offer was declined');
    bump();
  });

  useSocketEvent('game:opponentGone', (data) => {
    const game = current(data);
    if (!game) return;
    game.claimAt = { ...game.claimAt, [data.color]: toLocal(game, data.claimAt) };
    bump();
  });

  useSocketEvent('game:opponentBack', (data) => {
    const game = current(data);
    if (!game) return;
    game.claimAt = { ...game.claimAt, [data.color]: null };
    bump();
  });

  useSocketEvent('game:rematchOffer', (data) => {
    const game = current(data);
    if (!game) return;
    game.rematchOffer = data.color;
    bump();
  });

  useSocketEvent('game:rematchDeclined', (data) => {
    const game = current(data);
    if (!game) return;
    game.rematchOffer = null;
    if (data.color === game.role) toast.show('Your rematch offer was declined');
    bump();
  });

  useSocketEvent('game:rematch', (data) => {
    if (data.id === id) navigate(`/game/${data.newId}`);
  });

  // Turning premoves off in settings clears a pending one.
  useEffect(() => {
    const game = gameRef.current;
    if (!settings.premoves && game?.premove) {
      game.premove = null;
      bump();
    }
  }, [settings.premoves]);

  const act = useCallback(
    (event, extra = {}) =>
      request(event, { id, ...extra }).then((response) => {
        if (!response.ok) toast.show(response.message, { tone: 'danger' });
        return response;
      }),
    [id, toast]
  );

  const game = gameRef.current;
  const latest = game?.moves.length ?? 0;
  const shownPly = Math.min(viewPly, latest);
  const atLatest = shownPly === latest;

  const view = useMemo(() => {
    if (!game) return null;
    const fen = shownPly === 0 ? game.startFen : game.moves[shownPly - 1].fen;
    const uci = shownPly === 0 ? null : game.moves[shownPly - 1].uci;
    const pos = shownPly === latest ? game.pos : positionFromFen(fen);
    return { fen, lastMove: uci ? [uci.slice(0, 2), uci.slice(2, 4)] : null, check: checkSquare(pos), turn: pos.turn };
  }, [game, shownPly, latest, version]);

  const myTurn = Boolean(game) && game.status === 'playing' && game.pos.turn === game.role;
  const dests = useMemo(
    () => (game && myTurn && atLatest ? legalDests(game.pos, game.variant) : new Map()),
    [game, myTurn, atLatest, version]
  );

  const actions = useMemo(
    () => ({
      move: ({ from, to, promotion }) => sendMove(`${from}${to}${promotion ?? ''}`),
      setPremove: (premove) => {
        const g = gameRef.current;
        if (!g || g.status !== 'playing' || g.pos.turn === g.role) return;
        g.premove = premove;
        bump();
      },
      cancelPremove: () => {
        const g = gameRef.current;
        if (!g?.premove) return;
        g.premove = null;
        bump();
      },
      resign: () => act('game:resign'),
      abort: () => act('game:abort'),
      offerDraw: () => act('game:drawOffer'),
      respondDraw: (accept) => act('game:drawRespond', { accept }),
      claimVictory: () => act('game:claimVictory'),
      claimDraw: () => act('game:claimDraw'),
      offerRematch: () => act('game:rematchOffer'),
      respondRematch: (accept) => act('game:rematchRespond', { accept }),
    }),
    [sendMove, act]
  );

  if (state.phase !== 'live' || !game) return { phase: state.phase, code: state.code, message: state.message };

  const running = clocksRunning(game);
  return {
    phase: 'live',
    id: game.id,
    variant: game.variant,
    tc: game.tc,
    rated: game.rated,
    category: game.category,
    players: game.players,
    role: game.role,
    startFen: game.startFen,
    moves: game.moves,
    fen: view.fen,
    lastMove: view.lastMove,
    check: view.check,
    turn: view.turn,
    sideToMove: game.pos.turn,
    dests,
    viewPly: shownPly,
    atLatest,
    setViewPly,
    status: game.status,
    result: game.result,
    termination: game.termination,
    ratingDiffs: game.ratingDiffs,
    clocks: { ...game.clock },
    clockColor: running ? game.pos.turn : null,
    syncedAt: game.syncedAt,
    premove: game.premove,
    drawOffer: game.drawOffer,
    drawOffersLeft: game.drawOffersLeft[game.role],
    rematchOffer: game.rematchOffer,
    firstMoveDeadline: game.firstMoveDeadline,
    claimAt: game.claimAt,
    myTurn,
    ...actions,
  };
}

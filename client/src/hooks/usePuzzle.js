import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { makeSquare, opposite } from 'chessops/util';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { api } from '../lib/api.js';
import { isSolutionMove, solutionOf } from '../lib/chess/puzzle.js';
import { applyMove, fenOf, legalDests, positionFromFen } from '../lib/chess/rules.js';
import { moveSound, playSound } from '../lib/sounds.js';

const INTRO_MS = 600;
const REPLY_MS = 350;
const UNDO_MS = 500;
const SOLUTION_STEP_MS = 700;

const squares = (uci) => [uci.slice(0, 2), uci.slice(2, 4)];

function createRun(puzzle, { date = null, reported = false } = {}) {
  const pos = positionFromFen(puzzle.fen);
  return {
    puzzle,
    date,
    solution: solutionOf(puzzle),
    pos, // the position on the solution line
    fen: fenOf(pos), // what the board shows; differs from pos while a wrong move is on screen
    lastMove: null,
    ply: 0, // solution moves played so far
    playerColor: opposite(pos.turn),
    busy: true, // an animation is running and the player can't move
    played: [], // the solver's correct moves, sent to the server
    mistake: false,
    feedback: null, // null | 'good' | 'bad'
    highlights: null,
    outcome: null, // null | 'solved' | 'viewed'
    reported, // the attempt was already sent (retries never send again)
  };
}

const lastLineMove = (run) => (run.ply > 0 ? squares(run.solution[run.ply - 1]) : null);

function checkSquare(fen) {
  try {
    const pos = positionFromFen(fen);
    if (!pos.isCheck()) return null;
    const king = pos.board.kingOf(pos.turn);
    return king === undefined ? null : makeSquare(king);
  } catch {
    return null;
  }
}

/**
 * Puzzle controller. mode: 'rated' (signed in, rating changes), 'guest' (checked locally only) or
 * 'daily' (signed in, solving extends the streak). Mount a new component when the mode changes.
 * The current run lives in one mutable object; `version` re-renders after each change.
 */
export default function usePuzzle({ mode }) {
  const { setUser } = useAuth();
  const { settings } = useSettings();
  const runRef = useRef(null);
  const [version, bump] = useReducer((n) => n + 1, 0);
  const [load, setLoad] = useState({ status: 'loading', error: null });
  const [nonce, setNonce] = useState(0);
  // rated: { pending, diff, rating, error }; daily: { pending, solved, streak, best, error }
  const [report, setReport] = useState(null);
  const reportPromise = useRef(null);
  const timers = useRef(new Set());
  const soundRef = useRef(settings);
  soundRef.current = settings;

  const sound = useCallback((type) => {
    if (soundRef.current.sounds) playSound(type, soundRef.current.soundTheme);
  }, []);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current.clear();
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Plays the next move of the solution line.
  const advance = useCallback(
    (run) => {
      const uci = run.solution[run.ply];
      const played = applyMove(run.pos, uci);
      run.ply += 1;
      if (!played) return;
      run.fen = played.fen;
      run.lastMove = squares(uci);
      sound(moveSound(played.san));
    },
    [sound]
  );

  const start = useCallback(
    (run) => {
      clearTimers();
      later(() => {
        if (runRef.current !== run) return;
        advance(run);
        run.busy = false;
        bump();
      }, INTRO_MS);
    },
    [advance, clearTimers, later]
  );

  // ---- Loading ----

  useEffect(() => {
    const controller = new AbortController();
    clearTimers();
    if (runRef.current) runRef.current.busy = true;
    setLoad({ status: 'loading', error: null });

    (async () => {
      try {
        // A rated attempt still on its way would otherwise leave this puzzle as the current one.
        await reportPromise.current?.catch(() => {});
        const data = await api.get(mode === 'daily' ? '/puzzles/daily' : '/puzzles/next', { signal: controller.signal });
        const run = createRun(data.puzzle, { date: data.date, reported: mode === 'daily' && data.solved });
        runRef.current = run;
        setReport(mode === 'daily' ? { solved: data.solved, streak: data.streak, best: data.best } : null);
        setLoad({ status: 'ready', error: null });
        start(run);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setLoad({ status: 'error', error: err.message || "Couldn't load a puzzle" });
      }
    })();

    return () => controller.abort();
  }, [mode, nonce, clearTimers, start]);

  // ---- Reporting ----

  const sendRated = useCallback(
    (run, moves) => {
      run.reported = true;
      setReport({ pending: true });
      reportPromise.current = api
        .post(`/puzzles/${run.puzzle.id}/attempt`, { moves })
        .then((data) => {
          setReport({ diff: data.diff, rating: data.rating });
          setUser(data.user);
        })
        .catch((err) => setReport({ error: err.message }));
    },
    [setUser]
  );

  const sendDaily = useCallback(
    (run) => {
      run.reported = true;
      setReport((current) => ({ ...current, pending: true, error: null }));
      api
        .post('/puzzles/daily/attempt', { date: run.date, moves: run.played })
        .then((data) => {
          if (!data.solved) throw new Error("That didn't count. Try again.");
          setReport({ solved: true, justSolved: true, streak: data.streak, best: data.best });
          setUser(data.user);
        })
        .catch((err) => {
          run.reported = false;
          setReport((current) => ({ ...current, pending: false, error: err.message }));
        });
    },
    [setUser]
  );

  const finish = useCallback(
    (run, outcome) => {
      run.outcome = outcome;
      if (mode === 'rated' && !run.reported) sendRated(run, run.played);
      if (mode === 'daily' && outcome === 'solved' && !run.reported) sendDaily(run);
    },
    [mode, sendRated, sendDaily]
  );

  // ---- Player actions ----

  const move = useCallback(
    ({ from, to, promotion }) => {
      const run = runRef.current;
      if (!run || run.busy || run.outcome || run.pos.turn !== run.playerColor) return false;
      const uci = `${from}${to}${promotion ?? ''}`;
      const isLast = run.ply === run.solution.length - 1;

      if (!isSolutionMove(run.pos, uci, run.solution[run.ply], isLast)) {
        const shown = run.pos.clone();
        const played = applyMove(shown, uci);
        if (!played) return false;
        run.busy = true;
        run.fen = played.fen;
        run.lastMove = [from, to];
        run.highlights = { [to]: 'bad' };
        run.feedback = 'bad';
        run.mistake = true;
        sound(moveSound(played.san));
        if (mode === 'rated' && !run.reported) sendRated(run, [...run.played, uci]);
        later(() => {
          if (runRef.current !== run || run.outcome) return;
          run.fen = fenOf(run.pos);
          run.lastMove = lastLineMove(run);
          run.highlights = null;
          run.busy = false;
          bump();
        }, UNDO_MS);
        bump();
        return true;
      }

      const played = applyMove(run.pos, uci);
      run.played.push(uci);
      run.ply += 1;
      run.fen = played.fen;
      run.lastMove = [from, to];
      run.highlights = { [to]: 'good' };
      run.feedback = 'good';
      sound(moveSound(played.san));

      if (run.ply >= run.solution.length) {
        finish(run, 'solved');
      } else {
        run.busy = true;
        later(() => {
          if (runRef.current !== run || run.outcome) return;
          run.highlights = null;
          advance(run);
          run.busy = false;
          bump();
        }, REPLY_MS);
      }
      bump();
      return true;
    },
    [mode, advance, finish, later, sendRated, sound]
  );

  const viewSolution = useCallback(() => {
    const run = runRef.current;
    if (!run || run.outcome) return;
    clearTimers();
    run.fen = fenOf(run.pos);
    run.lastMove = lastLineMove(run);
    run.highlights = null;
    run.feedback = null;
    run.busy = true;
    finish(run, 'viewed');

    const step = () => {
      if (runRef.current !== run) return;
      if (run.ply >= run.solution.length) {
        run.busy = false;
        bump();
        return;
      }
      advance(run);
      bump();
      later(step, SOLUTION_STEP_MS);
    };
    later(step, 250);
    bump();
  }, [advance, clearTimers, finish, later]);

  // Replays the same puzzle for practice. An attempt that was already sent stays as it is.
  const retry = useCallback(() => {
    const old = runRef.current;
    if (!old) return;
    const run = createRun(old.puzzle, { date: old.date, reported: old.reported });
    runRef.current = run;
    start(run);
    bump();
  }, [start]);

  const next = useCallback(() => setNonce((n) => n + 1), []);

  // ---- View ----

  const run = runRef.current;
  const ready = load.status === 'ready' && Boolean(run);
  const canMove = ready && !run.busy && !run.outcome && run.pos.turn === run.playerColor;

  const dests = useMemo(() => (canMove ? legalDests(run.pos, 'standard') : new Map()), [canMove, run, version]);
  const check = useMemo(() => (run ? checkSquare(run.fen) : null), [run, run?.fen]);

  return {
    status: load.status, // 'loading' | 'ready' | 'error'
    error: load.error,
    reload: next,
    puzzle: run?.puzzle ?? null,
    date: run?.date ?? null,
    fen: run?.fen ?? null,
    playerColor: run?.playerColor ?? 'white',
    turn: run ? run.pos.turn : 'white',
    lastMove: run?.lastMove ?? null,
    check,
    dests,
    movableColor: canMove ? run.playerColor : null,
    highlights: run?.highlights ?? null,
    started: Boolean(run && run.ply > 0),
    feedback: run?.feedback ?? null,
    mistake: Boolean(run?.mistake),
    outcome: run?.outcome ?? null,
    report,
    onMove: move,
    viewSolution,
    retry,
    next,
  };
}

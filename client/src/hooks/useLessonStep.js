import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { makeSquare } from 'chessops/util';
import { useSettings } from '../context/SettingsContext.jsx';
import { fenOf, legalDests } from '../lib/chess/rules.js';
import { playStepMove, playStepReply, remainingTargets, piecesLeft, startStep } from '../lib/lessons.js';
import { moveSound, playSound } from '../lib/sounds.js';

const REPLY_MS = 350;
const UNDO_MS = 500;

const squares = (uci) => [uci.slice(0, 2), uci.slice(2, 4)];

function createRun(step) {
  const state = startStep(step);
  return {
    state,
    fen: fenOf(state.pos), // what the board shows; differs from state.pos while a wrong move is on screen
    lastMove: null,
    flash: null, // { square: 'good' | 'bad' }
    feedback: null, // null | 'good' | 'bad'
    hint: null,
    busy: false,
    touched: false,
  };
}

/**
 * One lesson step (see lib/lessons.js). The run lives in one mutable object; `version` re-renders.
 * Mount a new component (new key) for each step.
 */
export default function useLessonStep(step) {
  const { settings } = useSettings();
  const [run, setRun] = useState(() => createRun(step));
  const [version, bump] = useReducer((n) => n + 1, 0);
  const timers = useRef(new Set());
  const soundRef = useRef(settings);
  soundRef.current = settings;

  const sound = useCallback((san) => {
    if (soundRef.current.sounds) playSound(moveSound(san), soundRef.current.soundTheme);
  }, []);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const move = useCallback(
    ({ from, to, promotion }) => {
      const { state } = run;
      if (run.busy || state.done) return false;
      const result = playStepMove(step, state, `${from}${to}${promotion ?? ''}`);
      if (result.verdict === 'illegal') return false;
      const { played } = result;
      run.touched = true;
      sound(played.san);

      if (result.verdict === 'wrong') {
        const previousMove = run.lastMove;
        run.fen = played.fen;
        run.lastMove = [from, to];
        run.flash = { [to]: 'bad' };
        run.feedback = 'bad';
        run.hint = result.hint;
        run.busy = true;
        later(() => {
          run.fen = fenOf(state.pos);
          run.lastMove = previousMove;
          run.flash = null;
          run.busy = false;
          bump();
        }, UNDO_MS);
        bump();
        return true;
      }

      run.fen = played.fen;
      run.lastMove = [from, to];
      run.hint = null;
      const collected = step.goal.type === 'reach' && step.goal.targets.includes(to);
      const showGood = result.done || step.goal.type === 'line' || collected;
      run.flash = showGood ? { [to]: 'good' } : null;
      run.feedback = result.done || step.goal.type === 'line' ? 'good' : null;

      if (!result.done && step.goal.type === 'line') {
        run.busy = true;
        later(() => {
          const reply = playStepReply(step, state);
          if (reply) {
            run.fen = reply.fen;
            run.lastMove = squares(reply.uci);
            sound(reply.san);
          }
          run.flash = null;
          run.busy = false;
          bump();
        }, REPLY_MS);
      }
      bump();
      return true;
    },
    [run, step, later, sound]
  );

  const retry = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setRun(createRun(step));
  }, [step]);

  const { state } = run;
  const canMove = !run.busy && !state.done;
  const dests = useMemo(() => (canMove ? legalDests(state.pos, 'standard') : new Map()), [canMove, run, version]);

  const highlights = useMemo(() => {
    const marks = {};
    for (const square of remainingTargets(step, state)) marks[square] = 'star';
    return { ...marks, ...run.flash };
  }, [run, version, step]);

  const check = useMemo(() => {
    if (!state.pos.isCheck() || run.fen !== fenOf(state.pos)) return null;
    const king = state.pos.board.kingOf(state.pos.turn);
    return king === undefined ? null : makeSquare(king);
  }, [run, version]);

  const opponent = state.player === 'white' ? 'black' : 'white';

  return {
    fen: run.fen,
    player: state.player,
    turn: state.pos.turn,
    movableColor: canMove ? state.player : null,
    dests,
    lastMove: run.lastMove,
    check,
    highlights,
    feedback: run.feedback,
    hint: run.hint,
    done: state.done,
    touched: run.touched,
    starsLeft: remainingTargets(step, state).length,
    piecesLeft: piecesLeft(state.pos, opponent),
    move,
    retry,
  };
}

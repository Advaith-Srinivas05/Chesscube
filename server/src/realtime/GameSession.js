import { opposite } from 'chessops/util';
import { applyMove, endState, fenOf, repetitionKey, startPosition } from '../lib/chess/rules.js';

// Each player has this long to make their first move; missing it aborts the game.
export const FIRST_MOVE_MS = 30_000;
export const MAX_DRAW_OFFERS = 3;

const winFor = (color) => (color === 'white' ? '1-0' : '0-1');
const fail = (message, code) => ({ ok: false, message, code, events: [] });
const done = (events = []) => ({ ok: true, events });

/**
 * One live game: rules, clocks, draw and rematch offers. No sockets or database; every method takes
 * `now` (ms) and returns { ok, message?, code?, events } for the manager to broadcast and persist.
 *
 * Event types: move, end, drawOffer, drawDeclined, rematchOffer, rematchDeclined.
 * Players are { id, kind, username, avatar, rating, provisional }; `id` is the identity id and never leaves the server.
 */
export class GameSession {
  constructor({ id, variant = 'standard', initialFen = null, tc, rated = false, category, population, white, black, createdAt = Date.now() }) {
    Object.assign(this, { id, variant, initialFen, tc, rated, category, population, white, black, createdAt });
    this.pos = startPosition(variant, initialFen);
    this.moves = []; // normalised UCI
    this.sans = [];
    this.repetition = new Map([[repetitionKey(this.pos), 1]]);
    this.clock = { white: tc.base * 1000, black: tc.base * 1000 };
    this.turnStartedAt = createdAt;
    this.status = 'playing'; // 'playing' | 'ended'
    this.result = null; // '1-0' | '0-1' | '1/2-1/2' | null (aborted)
    this.termination = null;
    this.endedAt = null;
    this.drawOffer = null; // colour of the pending offer
    this.drawOffersUsed = { white: 0, black: 0 };
    this.rematchOffer = null;
    this.firstMoveDeadline = createdAt + FIRST_MOVE_MS;
  }

  // Rebuilds a stored game. The clock is the one saved after the last move and restarts now,
  // so time the server was down isn't charged to anyone.
  static restore({ moves, clock, ...options }, now) {
    const session = new GameSession({ ...options, createdAt: now });
    for (const uci of moves) {
      if (!session.#push(uci)) throw new Error(`Illegal stored move ${uci} in game ${options.id}`);
    }
    session.clock = { ...clock };
    session.turnStartedAt = now;
    session.firstMoveDeadline = moves.length < 2 ? now + FIRST_MOVE_MS : null;
    return session;
  }

  get turn() {
    return this.pos.turn;
  }

  // Clocks run from Black's first move onward.
  get clocksRunning() {
    return this.status === 'playing' && this.moves.length >= 2;
  }

  colorOf(identityId) {
    if (this.white.id === identityId) return 'white';
    if (this.black.id === identityId) return 'black';
    return null;
  }

  timeLeft(color, now) {
    if (!this.clocksRunning || this.turn !== color) return this.clock[color];
    return this.clock[color] - (now - this.turnStartedAt);
  }

  // When the manager should call flagCheck next, or null.
  nextTimerAt() {
    if (this.status !== 'playing') return null;
    if (this.firstMoveDeadline !== null) return this.firstMoveDeadline;
    return this.clocksRunning ? this.turnStartedAt + this.clock[this.turn] : null;
  }

  #push(uci) {
    const played = applyMove(this.pos, uci, this.variant);
    if (!played) return null;
    this.moves.push(played.uci);
    this.sans.push(played.san);
    const key = repetitionKey(this.pos);
    this.repetition.set(key, (this.repetition.get(key) ?? 0) + 1);
    return played;
  }

  #end(result, termination, now) {
    if (this.clocksRunning) this.clock[this.turn] = Math.max(0, this.timeLeft(this.turn, now));
    this.status = 'ended';
    this.result = result;
    this.termination = termination;
    this.endedAt = now;
    this.drawOffer = null;
    this.firstMoveDeadline = null;
    return { type: 'end', result, termination, clock: { ...this.clock } };
  }

  // `ply` is the number of moves the client had seen; anything else is a stale move.
  move(color, uci, ply, now) {
    if (this.status !== 'playing') return fail('The game is over');
    if (color !== this.turn) return fail('Not your turn');
    if (ply !== this.moves.length) return fail('The game moved on, reloading', 'STALE');
    if (this.clocksRunning && this.timeLeft(color, now) <= 0) {
      return { ...fail('Your time ran out'), events: this.flagCheck(now) };
    }

    const index = this.moves.length;
    const left = this.timeLeft(color, now);
    const played = this.#push(uci);
    if (!played) return fail('Illegal move', 'ILLEGAL');

    if (index >= 2) this.clock[color] = left + this.tc.inc * 1000;
    this.turnStartedAt = now;
    if (this.drawOffer === opposite(color)) this.drawOffer = null; // moving declines the offer
    this.firstMoveDeadline = index === 0 ? now + FIRST_MOVE_MS : null;

    const events = [
      {
        type: 'move',
        ply: index,
        uci: played.uci,
        san: played.san,
        fen: played.fen,
        clock: { ...this.clock },
        turnStartedAt: now,
        drawOffer: this.drawOffer,
        firstMoveDeadline: this.firstMoveDeadline,
      },
    ];
    const end = endState(this.pos, this.repetition);
    if (end) events.push(this.#end(end.result, end.termination, now));
    return done(events);
  }

  // Ends the game on time or aborts a game whose first moves never came. Returns the events (possibly none).
  flagCheck(now) {
    if (this.status !== 'playing') return [];
    if (this.firstMoveDeadline !== null) {
      return now >= this.firstMoveDeadline ? [this.#end(null, 'abort', now)] : [];
    }
    if (!this.clocksRunning || this.timeLeft(this.turn, now) > 0) return [];
    const winner = opposite(this.turn);
    if (this.pos.hasInsufficientMaterial(winner)) return [this.#end('1/2-1/2', 'timeoutVsInsufficient', now)];
    return [this.#end(winFor(winner), 'timeout', now)];
  }

  resign(color, now) {
    if (this.status !== 'playing') return fail('The game is over');
    if (this.moves.length < 2) return fail('Abort the game instead');
    return done([this.#end(winFor(opposite(color)), 'resign', now)]);
  }

  abort(color, now) {
    if (this.status !== 'playing') return fail('The game is over');
    if (this.moves.length >= 2) return fail('The game can no longer be aborted');
    return done([this.#end(null, 'abort', now)]);
  }

  offerDraw(color, now) {
    if (this.status !== 'playing') return fail('The game is over');
    if (this.moves.length < 2) return fail('Draws can be offered once both players have moved');
    // Offering while the opponent's offer is pending accepts it.
    if (this.drawOffer === opposite(color)) return done([this.#end('1/2-1/2', 'agreement', now)]);
    if (this.drawOffer === color) return fail('You already offered a draw');
    if (this.drawOffersUsed[color] >= MAX_DRAW_OFFERS) return fail('No draw offers left in this game');
    this.drawOffersUsed[color] += 1;
    this.drawOffer = color;
    return done([{ type: 'drawOffer', color }]);
  }

  respondDraw(color, accept, now) {
    if (this.status !== 'playing') return fail('The game is over');
    if (this.drawOffer !== opposite(color)) return fail('There is no draw offer to answer');
    if (accept) return done([this.#end('1/2-1/2', 'agreement', now)]);
    this.drawOffer = null;
    return done([{ type: 'drawDeclined', color: opposite(color) }]);
  }

  // The manager only allows claims once the opponent has been gone long enough.
  claimVictory(color, now) {
    if (this.status !== 'playing') return fail('The game is over');
    if (this.moves.length < 2) return fail('The game will be aborted instead');
    return done([this.#end(winFor(color), 'abandoned', now)]);
  }

  claimDraw(color, now) {
    if (this.status !== 'playing') return fail('The game is over');
    if (this.moves.length < 2) return fail('The game will be aborted instead');
    return done([this.#end('1/2-1/2', 'abandoned', now)]);
  }

  // `rematch: true` tells the manager both players agreed and the new game should start.
  offerRematch(color) {
    if (this.status !== 'ended') return fail('The game is still going');
    if (this.rematchOffer === opposite(color)) {
      this.rematchOffer = null;
      return { ...done(), rematch: true };
    }
    if (this.rematchOffer === color) return fail('You already offered a rematch');
    this.rematchOffer = color;
    return done([{ type: 'rematchOffer', color }]);
  }

  respondRematch(color, accept) {
    if (this.status !== 'ended') return fail('The game is still going');
    if (this.rematchOffer !== opposite(color)) return fail('There is no rematch offer to answer');
    this.rematchOffer = null;
    if (accept) return { ...done(), rematch: true };
    return done([{ type: 'rematchDeclined', color: opposite(color) }]);
  }

  snapshot(now) {
    const player = ({ kind, username, avatar, rating, provisional }) => ({ guest: kind === 'guest', username, avatar, rating, provisional });
    return {
      id: this.id,
      variant: this.variant,
      initialFen: this.initialFen,
      tc: this.tc,
      rated: this.rated,
      category: this.category,
      white: player(this.white),
      black: player(this.black),
      moves: this.moves.map((uci, index) => ({ uci, san: this.sans[index] })),
      fen: fenOf(this.pos),
      clock: { ...this.clock },
      turn: this.turn,
      turnStartedAt: this.turnStartedAt,
      serverNow: now,
      status: this.status,
      result: this.result,
      termination: this.termination,
      drawOffer: this.drawOffer,
      drawOffersLeft: {
        white: MAX_DRAW_OFFERS - this.drawOffersUsed.white,
        black: MAX_DRAW_OFFERS - this.drawOffersUsed.black,
      },
      rematchOffer: this.rematchOffer,
      firstMoveDeadline: this.firstMoveDeadline,
    };
  }
}

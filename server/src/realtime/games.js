import { opposite } from 'chessops/util';
import { z } from 'zod';
import { isProvisional } from '../lib/glicko2.js';
import { randomChess960Fen } from '../lib/chess/chess960.js';
import { GAME_ID_RE, gameId as newGameId } from '../lib/ids.js';
import { Friendship, pairKey } from '../models/Friendship.js';
import { Game } from '../models/Game.js';
import { User } from '../models/User.js';
import { applyGameResult } from '../services/ratings.js';
import { categoryFor } from '../shared/gameModes.js';
import { getIo, identityRoom } from './connections.js';
import { EventError, listen } from './events.js';
import { GameSession } from './GameSession.js';

// A player may claim the game once their opponent has had no connection to it for this long.
export const CLAIM_AFTER_MS = 30_000;
// Finished games stay in memory a little while, for rematches and late reloads.
const KEEP_ENDED_MS = 2 * 60_000;

/**
 * id -> { session, timer, dropTimer, sockets: { white: Set, black: Set }, goneSince: { white, black },
 *         spectators: Map(socket id -> identity id), persist: Promise (serialises this game's database writes), rematchId }
 */
const games = new Map();
const activeByIdentity = new Map(); // identity id -> game id, for games still being played
const startListeners = [];
const endListeners = [];

const gameRoom = (id) => `game:${id}`;
const emit = (room, event, data) => getIo()?.to(room).emit(event, data);

export function activeGameOf(identityId) {
  return activeByIdentity.get(identityId) ?? null;
}

export function activeGameCount() {
  let count = 0;
  for (const { session } of games.values()) if (session.status === 'playing') count += 1;
  return count;
}

// fn([whiteId, blackId]) runs whenever a game starts, so the lobby can drop those players' open games.
export function onGameStart(fn) {
  startListeners.push(fn);
}

// fn([whiteId, blackId]) runs when a game ends (players are free again).
export function onGameEnd(fn) {
  endListeners.push(fn);
}

function register(session, { goneSince = null } = {}) {
  const entry = {
    session,
    timer: null,
    dropTimer: null,
    sockets: { white: new Set(), black: new Set() },
    spectators: new Map(), // socket id -> identity id
    goneSince: { white: goneSince, black: goneSince },
    persist: Promise.resolve(),
    moveWriteQueued: false,
    lastMove: null,
    rematchId: null,
  };
  games.set(session.id, entry);
  activeByIdentity.set(session.white.id, session.id);
  activeByIdentity.set(session.black.id, session.id);
  schedule(entry);
  return entry;
}

function queueWrite(entry, write) {
  entry.persist = entry.persist.then(write).catch((err) => console.error(`Saving game ${entry.session.id} failed:`, err));
  return entry.persist;
}

function schedule(entry) {
  clearTimeout(entry.timer);
  const at = entry.session.nextTimerAt();
  if (at === null) return;
  // setTimeout can fire a touch early; flagCheck simply finds nothing due and this reschedules.
  entry.timer = setTimeout(() => {
    handleEvents(entry, entry.session.flagCheck(Date.now()));
    schedule(entry);
  }, Math.max(0, at - Date.now()) + 5);
}

// Broadcasts and persists session events. Resolves once a game that ended here is fully finished.
function handleEvents(entry, events) {
  const { session } = entry;
  const room = gameRoom(session.id);
  let finished = Promise.resolve();
  for (const event of events) {
    const { type, ...data } = event;
    if (type === 'move') {
      emit(room, 'game:move', { id: session.id, ...data, serverNow: Date.now() });
      if (session.population === 'users') {
        entry.lastMove = { clock: { w: data.clock.white, b: data.clock.black }, turnStartedAt: new Date(data.turnStartedAt) };
        // Every write stores the whole move list, so one queued write that reads the latest state when it runs covers
        // any moves made while earlier writes are in flight. This keeps a crash from losing more than one round trip.
        if (!entry.moveWriteQueued) {
          entry.moveWriteQueued = true;
          queueWrite(entry, () => {
            entry.moveWriteQueued = false;
            return Game.updateOne({ _id: session.id }, { $set: { moves: session.moves.join(' '), ...entry.lastMove } });
          });
        }
      }
    } else if (type === 'end') {
      finished = finishGame(entry, data).catch((err) => console.error(`Finishing game ${session.id} failed:`, err));
    } else {
      emit(room, `game:${type}`, { id: session.id, ...data });
    }
  }
  if (session.status === 'playing') schedule(entry);
  return finished;
}

async function finishGame(entry, end) {
  const { session } = entry;
  clearTimeout(entry.timer);
  for (const color of ['white', 'black']) {
    const identityId = session[color].id;
    if (activeByIdentity.get(identityId) === session.id) {
      activeByIdentity.delete(identityId);
      emit(identityRoom(identityId), 'session:activeGame', { id: null });
    }
  }
  for (const listener of endListeners) listener([session.white.id, session.black.id]);

  let ratingDiffs = null;
  try {
    ratingDiffs = await applyGameResult(session);
  } catch (err) {
    console.error(`Rating game ${session.id} failed:`, err);
  }
  session.ratingDiffs = ratingDiffs;

  if (session.population === 'users') {
    queueWrite(entry, () =>
      end.result
        ? Game.updateOne(
            { _id: session.id },
            {
              $set: {
                status: 'ended',
                result: end.result,
                termination: end.termination,
                endedAt: new Date(session.endedAt),
                clock: { w: end.clock.white, b: end.clock.black },
                ...(ratingDiffs && { 'white.diff': ratingDiffs.white, 'black.diff': ratingDiffs.black }),
              },
              $unset: { turnStartedAt: 1 },
            }
          )
        : Game.deleteOne({ _id: session.id }) // aborted games aren't kept
    );
  }

  emit(gameRoom(session.id), 'game:end', { id: session.id, ...end, ratingDiffs });
  entry.dropTimer = setTimeout(() => {
    if (games.get(session.id) === entry) games.delete(session.id);
  }, KEEP_ENDED_MS);
  entry.dropTimer.unref();
}

async function playersFor(population, category, white, black) {
  if (population !== 'users') {
    const guest = ({ id, username }) => ({ id, kind: 'guest', username, avatar: null, rating: null, provisional: false });
    return [guest(white), guest(black)];
  }
  const users = await User.find({ _id: { $in: [white.id, black.id] } })
    .select(`username avatar ratings.${category}`)
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  return [white, black].map(({ id }) => {
    const user = byId.get(id);
    if (!user) throw new EventError('That player is no longer available');
    const { r, rd } = user.ratings[category];
    return { id, kind: 'user', username: user.username, avatar: user.avatar, rating: Math.round(r), provisional: isProvisional(rd) };
  });
}

/**
 * Starts a game between two identities ({ id, kind, username }) of the same population.
 * Registered games get their document straight away. Emits game:start to both players.
 */
export async function createGame({ population, variant = 'standard', initialFen = null, tc, rated = false, white, black }) {
  if (white.id === black.id) throw new EventError("You can't play against yourself");
  const ensureFree = () => {
    if (activeByIdentity.has(white.id) || activeByIdentity.has(black.id)) {
      throw new EventError('One of the players is already in a game', 'IN_GAME');
    }
  };
  ensureFree();

  const category = categoryFor({ variant, ...tc });
  const [whitePlayer, blackPlayer] = await playersFor(population, category, white, black);
  ensureFree(); // again: another pairing may have started a game during the query

  const now = Date.now();
  const options = {
    variant,
    initialFen: variant === 'chess960' ? (initialFen ?? randomChess960Fen()) : null,
    tc: { base: tc.base, inc: tc.inc },
    rated: population === 'users' && rated,
    category,
    population,
    white: whitePlayer,
    black: blackPlayer,
    createdAt: now,
  };

  // Reserve both players before the insert so nothing else can pair them meanwhile.
  let session = null;
  for (let attempt = 0; attempt < 5 && !session; attempt++) {
    const id = newGameId();
    if (games.has(id)) continue;
    const candidate = new GameSession({ id, ...options });
    const entry = register(candidate);
    if (population !== 'users') {
      session = candidate;
      break;
    }
    try {
      await Game.create({
        _id: id,
        variant,
        initialFen: options.initialFen ?? undefined,
        category,
        tc: options.tc,
        rated: options.rated,
        players: [white.id, black.id],
        white: { user: white.id, rating: whitePlayer.rating },
        black: { user: black.id, rating: blackPlayer.rating },
        status: 'active',
        clock: { w: tc.base * 1000, b: tc.base * 1000 },
        turnStartedAt: new Date(now),
        startedAt: new Date(now),
      });
      session = candidate;
    } catch (err) {
      clearTimeout(entry.timer);
      games.delete(id);
      activeByIdentity.delete(white.id);
      activeByIdentity.delete(black.id);
      if (err.code !== 11000) throw err;
    }
  }
  if (!session) throw new EventError('Could not start the game, try again');

  for (const listener of startListeners) listener([white.id, black.id]);
  for (const player of [white, black]) {
    emit(identityRoom(player), 'game:start', { id: session.id });
    emit(identityRoom(player), 'session:activeGame', { id: session.id });
  }
  return session;
}

function snapshotOf(entry) {
  const now = Date.now();
  const claimAt = (color) => (entry.goneSince[color] === null ? null : entry.goneSince[color] + CLAIM_AFTER_MS);
  return {
    ...entry.session.snapshot(now),
    ratingDiffs: entry.session.ratingDiffs ?? null,
    gone: { white: claimAt('white'), black: claimAt('black') },
    spectators: spectatorCount(entry),
  };
}

// Watchers counted per person, not per tab.
const spectatorCount = (entry) => new Set(entry.spectators.values()).size;

function broadcastSpectators(entry) {
  emit(gameRoom(entry.session.id), 'game:spectators', { id: entry.session.id, count: spectatorCount(entry) });
}

// The colour a signed-in viewer watches: a friend's, or null when they're friends with neither player.
async function friendColorFor(viewerId, session) {
  if (session.population !== 'users') return null;
  const friendships = await Friendship.find({
    pair: { $in: [pairKey(viewerId, session.white.id), pairKey(viewerId, session.black.id)] },
    status: 'accepted',
  })
    .select('pair')
    .lean();
  if (friendships.some((friendship) => friendship.pair === pairKey(viewerId, session.white.id))) return 'white';
  return friendships.length ? 'black' : null;
}

// A colour whose last socket left the game: the opponent may claim after CLAIM_AFTER_MS.
function leaveGame(socket, id) {
  socket.leave(gameRoom(id));
  socket.data.gameIds.delete(id);
  const entry = games.get(id);
  if (!entry) return;
  if (entry.spectators.delete(socket.id)) {
    broadcastSpectators(entry);
    return;
  }
  const color = entry.session.colorOf(socket.data.identity.id);
  if (!color) return;
  const sockets = entry.sockets[color];
  if (!sockets.delete(socket.id) || sockets.size > 0 || entry.session.status !== 'playing') return;
  entry.goneSince[color] = Date.now();
  emit(gameRoom(id), 'game:opponentGone', { id, color, claimAt: entry.goneSince[color] + CLAIM_AFTER_MS });
}

async function startRematch(entry) {
  const { session } = entry;
  if (entry.rematchId) return;
  const identity = ({ id, kind, username }) => ({ id, kind, username });
  const next = await createGame({
    population: session.population,
    variant: session.variant,
    tc: session.tc,
    rated: session.rated,
    white: identity(session.black),
    black: identity(session.white),
  });
  entry.rematchId = next.id;
  emit(gameRoom(session.id), 'game:rematch', { id: session.id, newId: next.id });
}

const idSchema = z.object({ id: z.string().regex(GAME_ID_RE, 'Game not found') });

export function registerGameHandlers(socket) {
  const { identity } = socket.data;
  socket.data.gameIds = new Set();

  // The game and the caller's colour in it, for player-only actions.
  function mine(id) {
    const entry = games.get(id);
    const color = entry?.session.colorOf(identity.id);
    if (!color) throw new EventError('Game not found', 'NOT_FOUND');
    return { entry, color };
  }

  function act(entry, result) {
    handleEvents(entry, result.events);
    if (!result.ok) throw new EventError(result.message, result.code);
    return result;
  }

  listen(socket, 'game:join', idSchema, async ({ id }) => {
    const entry = games.get(id);
    if (!entry) throw new EventError('Game not found', 'NOT_FOUND');
    const color = entry.session.colorOf(identity.id);

    // Friends of either player may watch. Spectators get every broadcast; player actions refuse them.
    if (!color) {
      const watching = identity.kind === 'user' ? await friendColorFor(identity.id, entry.session) : null;
      if (!watching) throw new EventError('You can only watch games your friends are playing', 'NOT_PLAYER');
      if (games.get(id) !== entry) throw new EventError('Game not found', 'NOT_FOUND');
      socket.join(gameRoom(id));
      socket.data.gameIds.add(id);
      entry.spectators.set(socket.id, identity.id);
      broadcastSpectators(entry);
      return { snapshot: snapshotOf(entry), role: 'spectator', watching };
    }

    socket.join(gameRoom(id));
    socket.data.gameIds.add(id);
    const sockets = entry.sockets[color];
    const wasGone = sockets.size === 0 && entry.goneSince[color] !== null;
    sockets.add(socket.id);
    if (wasGone) {
      entry.goneSince[color] = null;
      emit(gameRoom(id), 'game:opponentBack', { id, color });
    }
    return { snapshot: snapshotOf(entry), role: color };
  });

  listen(socket, 'game:leave', idSchema, ({ id }) => {
    leaveGame(socket, id);
  });

  socket.on('disconnect', () => {
    for (const id of [...socket.data.gameIds]) leaveGame(socket, id);
  });

  listen(
    socket,
    'game:move',
    idSchema.extend({ uci: z.string().min(4).max(5), ply: z.number().int().min(0) }),
    ({ id, uci, ply }) => {
      const { entry, color } = mine(id);
      act(entry, entry.session.move(color, uci, ply, Date.now()));
    }
  );

  const simple = (event, method) =>
    listen(socket, event, idSchema, ({ id }) => {
      const { entry, color } = mine(id);
      act(entry, entry.session[method](color, Date.now()));
    });
  simple('game:resign', 'resign');
  simple('game:abort', 'abort');
  simple('game:drawOffer', 'offerDraw');

  listen(socket, 'game:drawRespond', idSchema.extend({ accept: z.boolean() }), ({ id, accept }) => {
    const { entry, color } = mine(id);
    act(entry, entry.session.respondDraw(color, accept, Date.now()));
  });

  const claim = (event, method) =>
    listen(socket, event, idSchema, ({ id }) => {
      const { entry, color } = mine(id);
      const other = opposite(color);
      const since = entry.goneSince[other];
      if (entry.sockets[other].size > 0 || since === null || Date.now() - since < CLAIM_AFTER_MS) {
        throw new EventError('Your opponent is still connected');
      }
      act(entry, entry.session[method](color, Date.now()));
    });
  claim('game:claimVictory', 'claimVictory');
  claim('game:claimDraw', 'claimDraw');

  listen(socket, 'game:rematchOffer', idSchema, async ({ id }) => {
    const { entry, color } = mine(id);
    if (entry.rematchId) return { newId: entry.rematchId };
    const result = act(entry, entry.session.offerRematch(color));
    if (result.rematch) await startRematch(entry);
  });

  listen(socket, 'game:rematchRespond', idSchema.extend({ accept: z.boolean() }), async ({ id, accept }) => {
    const { entry, color } = mine(id);
    const result = act(entry, entry.session.respondRematch(color, accept));
    if (result.rematch) await startRematch(entry);
  });
}

// Rebuilds active registered games after a restart. Players get back in by reopening the game.
export async function restoreGames() {
  const docs = await Game.find({ status: 'active' }).lean();
  if (!docs.length) return;
  const ids = [...new Set(docs.flatMap((doc) => doc.players.map(String)))];
  const users = await User.find({ _id: { $in: ids } }).select('username avatar ratings').lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const now = Date.now();

  for (const doc of docs) {
    try {
      const player = (side) => {
        const user = byId.get(String(side.user));
        if (!user) throw new Error('a player no longer exists');
        const id = String(side.user);
        return { id, kind: 'user', username: user.username, avatar: user.avatar, rating: side.rating, provisional: isProvisional(user.ratings[doc.category].rd) };
      };
      const session = GameSession.restore(
        {
          id: doc._id,
          variant: doc.variant,
          initialFen: doc.initialFen ?? null,
          tc: doc.tc,
          rated: doc.rated,
          category: doc.category,
          population: 'users',
          white: player(doc.white),
          black: player(doc.black),
          moves: doc.moves ? doc.moves.split(' ') : [],
          clock: { white: doc.clock.w, black: doc.clock.b },
        },
        now
      );
      // Nobody is connected yet: a player who never returns can be claimed against as usual.
      register(session, { goneSince: now });
    } catch (err) {
      console.error(`Could not restore game ${doc._id} (${err.message}); removing it`);
      await Game.deleteOne({ _id: doc._id });
    }
  }
  console.log(`Restored ${games.size} active game(s)`);
}

// Saves every live registered game's moves and clocks (time spent on the current move included).
export async function persistActiveGames() {
  const now = Date.now();
  const writes = [...games.values()]
    .filter(({ session }) => session.population === 'users' && session.status === 'playing')
    .map((entry) => {
      const { session } = entry;
      clearTimeout(entry.timer);
      const clock = { w: Math.max(0, session.timeLeft('white', now)), b: Math.max(0, session.timeLeft('black', now)) };
      return queueWrite(entry, () => Game.updateOne({ _id: session.id }, { $set: { moves: session.moves.join(' '), clock } }));
    });
  await Promise.all(writes);
}

// A deleted account resigns (or aborts) its live game straight away.
export async function endGameOf(identityId) {
  const entry = games.get(activeByIdentity.get(identityId));
  if (!entry) return;
  const { session } = entry;
  const color = session.colorOf(identityId);
  const now = Date.now();
  const result = session.moves.length < 2 ? session.abort(color, now) : session.resign(color, now);
  await handleEvents(entry, result.events);
  await entry.persist;
}

import crypto from 'node:crypto';
import { z } from 'zod';
import { isProvisional } from '../lib/glicko2.js';
import { User } from '../models/User.js';
import { categoryFor, isValidTimeControl, QUICK_PAIRINGS, VARIANTS } from '../shared/gameModes.js';
import { getIo, identityRoom, onIdentityGone, populationOf } from './connections.js';
import { EventError, listen } from './events.js';
import { activeGameOf, createGame, onGameStart } from './games.js';

/**
 * Open games waiting for an opponent. Quick pairing tiles are presets for these: a quick request joins
 * the oldest matching open game, or opens one that the next player with the same preset joins.
 * id -> { id, owner: identity, population, variant, tc, rated, color, rating, provisional, presetId, createdAt }
 */
const seeks = new Map();
const seekIdByOwner = new Map();

const lobbyRoom = (population) => `lobby:${population}`;

export function publicSeek(seek) {
  return {
    id: seek.id,
    player: { username: seek.owner.username, avatar: seek.owner.avatar ?? null },
    rating: seek.rating,
    provisional: seek.provisional,
    base: seek.tc.base,
    inc: seek.tc.inc,
    rated: seek.rated,
    variant: seek.variant,
    color: seek.color,
    presetId: seek.presetId,
    createdAt: seek.createdAt,
  };
}

export function ownSeekOf(identityId) {
  const seek = seeks.get(seekIdByOwner.get(identityId));
  return seek ? publicSeek(seek) : null;
}

// Every tab of the owner shows the same waiting state.
function notifyOwner(identityId) {
  getIo()?.to(identityRoom(identityId)).emit('lobby:own', { seek: ownSeekOf(identityId) });
}

export function removeSeekOf(identityId) {
  const id = seekIdByOwner.get(identityId);
  if (!id) return;
  const seek = seeks.get(id);
  seeks.delete(id);
  seekIdByOwner.delete(identityId);
  getIo()?.to(lobbyRoom(seek.population)).emit('lobby:removed', { id });
  notifyOwner(identityId);
}

onGameStart((ids) => ids.forEach(removeSeekOf));
onIdentityGone(removeSeekOf);

/**
 * The open game a quick request should join: same population, standard chess, same time control and
 * rated/casual mode, not the requester's own. Oldest first.
 */
export function findQuickMatch(openSeeks, { identityId, population, base, inc, rated }) {
  let best = null;
  for (const seek of openSeeks) {
    if (seek.owner.id === identityId || seek.population !== population || seek.variant !== 'standard') continue;
    if (seek.tc.base !== base || seek.tc.inc !== inc || seek.rated !== rated) continue;
    if (!best || seek.createdAt < best.createdAt) best = seek;
  }
  return best;
}

async function ratingFor(identity, category) {
  if (identity.kind !== 'user') return { rating: null, provisional: false };
  const user = await User.findById(identity.id).select(`ratings.${category}`).lean();
  if (!user) throw new EventError('Sign in again');
  return { rating: Math.round(user.ratings[category].r), provisional: isProvisional(user.ratings[category].rd) };
}

// Opens a seek for `identity`, replacing any open one (one per player).
function openSeek(identity, fields) {
  removeSeekOf(identity.id);
  const seek = { id: crypto.randomUUID(), owner: identity, population: populationOf(identity), presetId: null, createdAt: Date.now(), ...fields };
  seeks.set(seek.id, seek);
  seekIdByOwner.set(identity.id, seek.id);
  getIo()?.to(lobbyRoom(seek.population)).emit('lobby:added', publicSeek(seek));
  notifyOwner(identity.id);
  return seek;
}

// Starts the game for an open seek. The seek is removed first, so nobody else can take it meanwhile.
function acceptSeek(seek, identity) {
  removeSeekOf(seek.owner.id);
  const ownerWhite = seek.color === 'random' ? Math.random() < 0.5 : seek.color === 'white';
  return createGame({
    population: seek.population,
    variant: seek.variant,
    tc: seek.tc,
    rated: seek.rated,
    white: ownerWhite ? seek.owner : identity,
    black: ownerWhite ? identity : seek.owner,
  });
}

const createSchema = z.object({
  variant: z.enum(VARIANTS.map((variant) => variant.id)),
  base: z.number().int(),
  inc: z.number().int(),
  rated: z.boolean(),
  color: z.enum(['white', 'black', 'random']),
});

export function registerLobbyHandlers(socket) {
  const { identity } = socket.data;
  const population = populationOf(identity);

  const ensureFree = () => {
    if (activeGameOf(identity.id)) throw new EventError('Finish your current game first', 'IN_GAME');
  };

  listen(socket, 'lobby:subscribe', null, () => {
    socket.join(lobbyRoom(population));
    const list = [...seeks.values()].filter((seek) => seek.population === population).map(publicSeek);
    return { seeks: list, ownSeekId: seekIdByOwner.get(identity.id) ?? null };
  });

  listen(socket, 'lobby:unsubscribe', null, () => {
    socket.leave(lobbyRoom(population));
  });

  listen(socket, 'lobby:create', createSchema, async ({ variant, base, inc, rated, color }) => {
    if (!isValidTimeControl({ base, inc })) throw new EventError('Choose a time control from the sliders');
    if (rated && population !== 'users') throw new EventError('Sign in to play rated games');
    ensureFree();
    const ratingInfo = await ratingFor(identity, categoryFor({ variant, base, inc }));
    ensureFree();
    const seek = openSeek(identity, { variant, tc: { base, inc }, rated, color, ...ratingInfo });
    return { seek: publicSeek(seek) };
  });

  // Quick pairing: join a matching open game, or open one. Users play rated, guests casual.
  listen(socket, 'lobby:quick', z.object({ presetId: z.string().max(10) }), async ({ presetId }) => {
    const preset = QUICK_PAIRINGS.find((entry) => entry.id === presetId);
    if (!preset) throw new EventError('Unknown time control');
    ensureFree();
    const rated = population === 'users';
    const ratingInfo = await ratingFor(identity, categoryFor({ variant: 'standard', ...preset }));
    ensureFree();

    // No awaits between the lookup and opening a seek, so two simultaneous requests can't both open one.
    const match = findQuickMatch(seeks.values(), { identityId: identity.id, population, base: preset.base, inc: preset.inc, rated });
    if (match) {
      const game = await acceptSeek(match, identity);
      return { matched: true, id: game.id };
    }
    const seek = openSeek(identity, { variant: 'standard', tc: { base: preset.base, inc: preset.inc }, rated, color: 'random', presetId, ...ratingInfo });
    return { matched: false, seek: publicSeek(seek) };
  });

  listen(socket, 'lobby:cancel', null, () => {
    removeSeekOf(identity.id);
  });

  listen(socket, 'lobby:accept', z.object({ seekId: z.string().max(64) }), async ({ seekId }) => {
    const seek = seeks.get(seekId);
    if (!seek || seek.population !== population) throw new EventError('That game is no longer open', 'GONE');
    if (seek.owner.id === identity.id) throw new EventError("You can't accept your own game");
    ensureFree();
    const game = await acceptSeek(seek, identity);
    return { id: game.id };
  });
}

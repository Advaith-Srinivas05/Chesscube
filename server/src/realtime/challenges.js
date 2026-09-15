import crypto from 'node:crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { isValidTimeControl, VARIANTS } from '../shared/gameModes.js';
import { emitToUser, isOnline, onIdentityGone } from './connections.js';
import { EventError, listen } from './events.js';
import { activeGameOf, createGame, onGameStart } from './games.js';
import { areFriends } from './presence.js';

export const CHALLENGE_TTL_MS = 60_000;

/** id -> { id, from: identity, to: { id, username, avatar }, settings, expiresAt, timer } */
const challenges = new Map();
const outgoingBy = new Map(); // sender id -> challenge id

// expiresIn (ms) rather than a timestamp, so a browser clock that's off doesn't skew the countdown.
const summary = (challenge) => ({ id: challenge.id, settings: challenge.settings, expiresIn: Math.max(0, challenge.expiresAt - Date.now()) });
const mini = (user) => ({ username: user.username, avatar: user.avatar ?? null });

// Removes a challenge and tells both players why: 'cancelled' | 'declined' | 'expired' | 'unavailable' | 'accepted'.
function close(challenge, reason, extra = {}) {
  if (challenges.get(challenge.id) !== challenge) return false;
  clearTimeout(challenge.timer);
  challenges.delete(challenge.id);
  if (outgoingBy.get(challenge.from.id) === challenge.id) outgoingBy.delete(challenge.from.id);
  const payload = { id: challenge.id, reason, from: mini(challenge.from), to: mini(challenge.to), ...extra };
  emitToUser(challenge.from.id, 'challenge:closed', payload);
  emitToUser(challenge.to.id, 'challenge:closed', payload);
  return true;
}

// Every challenge involving these users ends, e.g. when one of them starts a game or disconnects.
export function dropChallengesOf(userIds) {
  const ids = new Set(userIds.map(String));
  for (const challenge of [...challenges.values()]) {
    if (ids.has(challenge.from.id) || ids.has(challenge.to.id)) close(challenge, 'unavailable');
  }
}

onGameStart((ids) => dropChallengesOf(ids));
onIdentityGone((id) => dropChallengesOf([id]));

// Pending challenges for a user who just connected (a new tab shows them too).
export function incomingFor(userId) {
  return [...challenges.values()].filter((challenge) => challenge.to.id === userId).map((challenge) => ({ ...summary(challenge), from: mini(challenge.from) }));
}

const settingsSchema = z.object({
  variant: z.enum(VARIANTS.map((variant) => variant.id)),
  base: z.number().int(),
  inc: z.number().int(),
  rated: z.boolean(),
  color: z.enum(['white', 'black', 'random']),
});

export function registerChallengeHandlers(socket) {
  const { identity } = socket.data;
  if (identity.kind !== 'user') return;

  // The challenge with this id, if the caller is on the given side of it.
  function find(id, side) {
    const challenge = challenges.get(id);
    if (!challenge || challenge[side].id !== identity.id) throw new EventError('That challenge is no longer open', 'GONE');
    return challenge;
  }

  listen(
    socket,
    'challenge:create',
    z.object({ username: z.string().trim().min(1).max(20), settings: settingsSchema }),
    async ({ username, settings }) => {
      if (!isValidTimeControl(settings)) throw new EventError('Choose a time control from the sliders');
      if (activeGameOf(identity.id)) throw new EventError('Finish your current game first', 'IN_GAME');

      const target = await User.findOne({ usernameLower: username.toLowerCase() }).select('username avatar').lean();
      if (!target) throw new EventError('Player not found');
      const targetId = String(target._id);
      if (targetId === identity.id) throw new EventError("You can't challenge yourself");
      if (!(await areFriends(identity.id, targetId))) throw new EventError('You can only challenge your friends');
      if (!isOnline(targetId)) throw new EventError(`${target.username} is offline`, 'OFFLINE');
      if (activeGameOf(targetId)) throw new EventError(`${target.username} is playing a game`, 'BUSY');
      if (activeGameOf(identity.id)) throw new EventError('Finish your current game first', 'IN_GAME');

      // One outgoing challenge at a time: a new one replaces the old.
      const previous = challenges.get(outgoingBy.get(identity.id));
      if (previous) close(previous, 'cancelled');

      const challenge = {
        id: crypto.randomUUID(),
        from: identity,
        to: { id: targetId, username: target.username, avatar: target.avatar },
        settings,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
      };
      challenge.timer = setTimeout(() => close(challenge, 'expired'), CHALLENGE_TTL_MS);
      challenge.timer.unref();
      challenges.set(challenge.id, challenge);
      outgoingBy.set(identity.id, challenge.id);

      emitToUser(targetId, 'challenge:incoming', { ...summary(challenge), from: mini(identity) });
      return summary(challenge);
    }
  );

  listen(socket, 'challenge:cancel', z.object({ id: z.string().max(64) }), ({ id }) => {
    close(find(id, 'from'), 'cancelled');
  });

  listen(socket, 'challenge:decline', z.object({ id: z.string().max(64) }), ({ id }) => {
    close(find(id, 'to'), 'declined');
  });

  listen(socket, 'challenge:accept', z.object({ id: z.string().max(64) }), async ({ id }) => {
    const challenge = find(id, 'to');
    if (activeGameOf(identity.id)) throw new EventError('Finish your current game first', 'IN_GAME');
    // Closed before the game starts, so a second accept can't create another game.
    clearTimeout(challenge.timer);
    challenges.delete(challenge.id);
    outgoingBy.delete(challenge.from.id);

    const { variant, base, inc, rated, color } = challenge.settings;
    const senderWhite = color === 'random' ? Math.random() < 0.5 : color === 'white';
    let game;
    try {
      game = await createGame({
        population: 'users',
        variant,
        tc: { base, inc },
        rated,
        white: senderWhite ? challenge.from : identity,
        black: senderWhite ? identity : challenge.from,
      });
    } catch (err) {
      challenges.set(challenge.id, challenge);
      close(challenge, 'unavailable');
      throw err;
    }
    challenges.set(challenge.id, challenge);
    close(challenge, 'accepted', { gameId: game.id });
    return { gameId: game.id };
  });
}

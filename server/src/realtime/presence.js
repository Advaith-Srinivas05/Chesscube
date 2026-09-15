import { Friendship, pairKey } from '../models/Friendship.js';
import { emitToUser, isOnline, onIdentityGone, onIdentityOnline } from './connections.js';
import { activeGameOf, onGameEnd, onGameStart } from './games.js';

/**
 * Live presence for signed-in users. Friends lists are cached while a user is connected, so presence
 * changes reach their friends without a query each time. Friends get
 * presence:update { username, online, gameId } when someone comes online, goes offline (after the
 * 5 s grace period), or starts or finishes a game.
 */
const friendsOf = new Map(); // user id -> Set of friend ids (only while connected)
const usernames = new Map(); // user id -> username, for payloads

const isUserId = (id) => !String(id).startsWith('g_');

export function presenceOf(userId) {
  const id = String(userId);
  return { online: isOnline(id), gameId: activeGameOf(id) };
}

async function loadFriends(userId) {
  const friendships = await Friendship.find({ $or: [{ from: userId }, { to: userId }], status: 'accepted' })
    .select('from to')
    .lean();
  return new Set(friendships.map(({ from, to }) => String(String(from) === userId ? to : from)));
}

export function areFriends(a, b) {
  return Friendship.exists({ pair: pairKey(a, b), status: 'accepted' }).then(Boolean);
}

async function notifyFriends(userId, presence = presenceOf(userId)) {
  const username = usernames.get(userId);
  if (!username) return;
  const friends = friendsOf.get(userId) ?? (await loadFriends(userId));
  for (const friendId of friends) emitToUser(friendId, 'presence:update', { username, ...presence });
}

const report = (err) => console.error('Presence update failed:', err);

onIdentityOnline((identity) => {
  if (identity.kind !== 'user') return;
  usernames.set(identity.id, identity.username);
  loadFriends(identity.id)
    .then((friends) => {
      if (!isOnline(identity.id)) return; // left again while loading
      friendsOf.set(identity.id, friends);
      return notifyFriends(identity.id);
    })
    .catch(report);
});

onIdentityGone((id) => {
  if (!isUserId(id)) return;
  notifyFriends(id, { online: false, gameId: activeGameOf(id) })
    .catch(report)
    .finally(() => {
      if (isOnline(id)) return;
      friendsOf.delete(id);
      usernames.delete(id);
    });
});

const onGameChange = (ids) => ids.filter(isUserId).forEach((id) => notifyFriends(id).catch(report));
onGameStart(onGameChange);
onGameEnd(onGameChange);

// ---- Called by the friends REST routes (same process) ----

function link(a, b) {
  friendsOf.get(a)?.add(b);
  friendsOf.get(b)?.add(a);
}

function unlink(a, b) {
  friendsOf.get(a)?.delete(b);
  friendsOf.get(b)?.delete(a);
}

// A new request: the recipient's badge and Socials page update, and the sender's other tabs.
export function friendRequestSent({ id, createdAt }, from, to) {
  const mini = (user) => ({ username: user.username, avatar: user.avatar });
  emitToUser(to._id, 'friends:request', { direction: 'incoming', request: { id, user: mini(from), createdAt } });
  emitToUser(from._id, 'friends:request', { direction: 'outgoing', request: { id, user: mini(to), createdAt } });
}

// Both sides learn about the new friendship, with each other's presence.
export function friendshipAccepted(a, b, since) {
  const [idA, idB] = [String(a._id), String(b._id)];
  link(idA, idB);
  emitToUser(idA, 'friends:accepted', { friend: { user: { username: b.username, avatar: b.avatar }, since, ...presenceOf(idB) } });
  emitToUser(idB, 'friends:accepted', { friend: { user: { username: a.username, avatar: a.avatar }, since, ...presenceOf(idA) } });
}

// A declined or cancelled request, or an unfriend: both sides drop the other from every list.
export function friendshipRemoved(a, b) {
  const [idA, idB] = [String(a._id), String(b._id)];
  unlink(idA, idB);
  emitToUser(idA, 'friends:removed', { username: b.username });
  emitToUser(idB, 'friends:removed', { username: a.username });
}

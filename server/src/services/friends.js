import { Friendship, pairKey } from '../models/Friendship.js';

export const MINI_USER_FIELDS = 'username avatar';

export const miniUser = (user) => ({ username: user.username, avatar: user.avatar });

// How `viewerId` stands with the other user of a friendship document (or none).
// relation: 'none' | 'friends' | 'incoming' | 'outgoing'; requestId is set while a request is pending.
export function relationOf(friendship, viewerId) {
  if (!friendship) return { relation: 'none' };
  if (friendship.status === 'accepted') return { relation: 'friends' };
  const outgoing = String(friendship.from) === String(viewerId);
  return { relation: outgoing ? 'outgoing' : 'incoming', requestId: String(friendship._id) };
}

// userId -> { relation, requestId? } for many users with a single query.
export async function relationsWith(viewerId, userIds) {
  const pairs = userIds.map((id) => pairKey(viewerId, id));
  const friendships = pairs.length ? await Friendship.find({ pair: { $in: pairs } }).lean() : [];
  const byPair = new Map(friendships.map((friendship) => [friendship.pair, friendship]));
  return new Map(userIds.map((id) => [String(id), relationOf(byPair.get(pairKey(viewerId, id)), viewerId)]));
}

export function relationWith(viewerId, userId) {
  return Friendship.findOne({ pair: pairKey(viewerId, userId) })
    .lean()
    .then((friendship) => relationOf(friendship, viewerId));
}

export function countIncomingRequests(userId) {
  return Friendship.countDocuments({ to: userId, status: 'pending' });
}

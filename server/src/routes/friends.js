import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { limiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { Friendship, pairKey } from '../models/Friendship.js';
import { User } from '../models/User.js';
import { MINI_USER_FIELDS, miniUser } from '../services/friends.js';

const MAX_OUTGOING = 50;
const HOUR = 60 * 60 * 1000;

const usernameParam = z.string().trim().min(1, 'Enter a username').max(20, 'Player not found');

function findUserByName(name) {
  return User.findOne({ usernameLower: name.toLowerCase() }).select(MINI_USER_FIELDS);
}

function friendEntry(friendship, other) {
  return { user: miniUser(other), since: friendship.acceptedAt };
}

function requestEntry(friendship, other) {
  return { id: String(friendship._id), user: miniUser(other), createdAt: friendship.createdAt };
}

async function acceptRequest(friendshipId, userId) {
  return Friendship.findOneAndUpdate(
    { _id: friendshipId, to: userId, status: 'pending' },
    { $set: { status: 'accepted', acceptedAt: new Date() } },
    { returnDocument: 'after' }
  ).populate('from', MINI_USER_FIELDS);
}

export const friendsRouter = Router();

friendsRouter.use(requireAuth);

friendsRouter.get('/', async (req, res) => {
  const me = req.user._id;
  const friendships = await Friendship.find({ $or: [{ from: me }, { to: me }] })
    .populate('from', MINI_USER_FIELDS)
    .populate('to', MINI_USER_FIELDS)
    .lean();

  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const friendship of friendships) {
    const isSender = friendship.from?._id.equals(me);
    const other = isSender ? friendship.to : friendship.from;
    if (!other) continue; // the other account was deleted mid-request
    if (friendship.status === 'accepted') friends.push(friendEntry(friendship, other));
    else (isSender ? outgoing : incoming).push(requestEntry(friendship, other));
  }

  friends.sort((a, b) => a.user.username.localeCompare(b.user.username, 'en', { sensitivity: 'base' }));
  const newestFirst = (a, b) => b.createdAt - a.createdAt;
  res.json({ friends, incoming: incoming.sort(newestFirst), outgoing: outgoing.sort(newestFirst) });
});

friendsRouter.post(
  '/requests',
  limiter({ windowMs: HOUR, limit: 100, keyGenerator: (req) => req.user.id }),
  validate({ body: z.object({ username: usernameParam }) }),
  async (req, res) => {
    const me = req.user;
    const target = await findUserByName(req.body.username);
    if (!target) throw new HttpError(404, 'Player not found');
    if (target._id.equals(me._id)) throw new HttpError(400, "You can't add yourself");

    const existing = await Friendship.findOne({ pair: pairKey(me._id, target._id) });
    if (existing?.status === 'accepted') throw new HttpError(409, `You're already friends with ${target.username}`);
    if (existing && existing.from.equals(me._id)) throw new HttpError(409, 'Friend request already sent');

    // They already asked you: sending one back accepts theirs.
    if (existing) {
      const accepted = await acceptRequest(existing._id, me._id);
      if (!accepted) throw new HttpError(409, 'That request changed, refresh and try again');
      return res.json({ status: 'accepted', friend: friendEntry(accepted, target) });
    }

    const pending = await Friendship.countDocuments({ from: me._id, status: 'pending' });
    if (pending >= MAX_OUTGOING) {
      throw new HttpError(400, `You can have at most ${MAX_OUTGOING} pending requests. Cancel some first.`);
    }

    // A simultaneous request for the same pair trips the unique index and becomes a 409.
    const friendship = await Friendship.create({ pair: pairKey(me._id, target._id), from: me._id, to: target._id });
    res.status(201).json({ status: 'pending', request: requestEntry(friendship, target) });
  }
);

const idParams = validate({
  params: z.object({ id: z.string().refine((id) => mongoose.isValidObjectId(id), 'Request not found') }),
});

friendsRouter.post('/requests/:id/accept', idParams, async (req, res) => {
  const accepted = await acceptRequest(req.params.id, req.user._id);
  if (!accepted?.from) throw new HttpError(404, 'Request not found');
  res.json({ status: 'accepted', friend: friendEntry(accepted, accepted.from) });
});

// The recipient declines or the sender cancels.
friendsRouter.delete('/requests/:id', idParams, async (req, res) => {
  const me = req.user._id;
  const deleted = await Friendship.findOneAndDelete({ _id: req.params.id, status: 'pending', $or: [{ from: me }, { to: me }] });
  if (!deleted) throw new HttpError(404, 'Request not found');
  res.status(204).end();
});

friendsRouter.delete('/:username', validate({ params: z.object({ username: usernameParam }) }), async (req, res) => {
  const target = await findUserByName(req.params.username);
  const result = target
    ? await Friendship.deleteOne({ pair: pairKey(req.user._id, target._id), status: 'accepted' })
    : { deletedCount: 0 };
  if (result.deletedCount === 0) throw new HttpError(404, "You aren't friends with that player");
  res.status(204).end();
});

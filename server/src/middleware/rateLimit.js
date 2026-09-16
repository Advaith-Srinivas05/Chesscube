import crypto from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { RateLimitHit } from '../models/RateLimitHit.js';

export { ipKeyGenerator };

// Keys hold IPs and email addresses; only a keyed hash of them is stored.
const hashKey = (key) => crypto.createHmac('sha256', env.jwtSecret).update(key).digest('base64url').slice(0, 22);

// express-rate-limit store backed by MongoDB, so counters survive restarts and deploys. One instance per limiter.
class MongoStore {
  constructor(name) {
    this.prefix = `${name}:`;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const now = new Date();
    const active = { $gt: ['$resetAt', now] };
    // A pipeline update restarts the window atomically once it has passed.
    const update = [
      {
        $set: {
          hits: { $cond: [active, { $add: ['$hits', 1] }, 1] },
          resetAt: { $cond: [active, '$resetAt', new Date(now.getTime() + this.windowMs)] },
        },
      },
    ];
    const run = () =>
      RateLimitHit.collection.findOneAndUpdate({ _id: this.prefix + hashKey(key) }, update, {
        upsert: true,
        returnDocument: 'after',
      });
    let doc;
    try {
      doc = await run();
    } catch (err) {
      // Two first hits at once: one upsert loses the unique _id race; the retry updates the new document.
      if (err.code !== 11000) throw err;
      doc = await run();
    }
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  async decrement(key) {
    await RateLimitHit.collection.updateOne(
      { _id: this.prefix + hashKey(key), hits: { $gt: 0 }, resetAt: { $gt: new Date() } },
      { $inc: { hits: -1 } }
    );
  }

  async resetKey(key) {
    await RateLimitHit.collection.deleteOne({ _id: this.prefix + hashKey(key) });
  }
}

/**
 * `name` keeps the counters in MongoDB under that prefix (use it for anything protecting accounts or email);
 * without it they live in memory and reset on restart. req.ip is the resolved client IP (see app.js).
 */
export function limiter({ windowMs, limit, keyGenerator, skipSuccessfulRequests = false, name, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { message: message ?? 'Too many attempts, try again later' },
    // req.ip is set from our own proxy header or the host's proxy (app.js), not from Express's 'trust proxy'.
    validate: { trustProxy: false, xForwardedForHeader: false },
    ...(name && { store: new MongoStore(name) }),
    ...(keyGenerator && { keyGenerator }),
  });
}

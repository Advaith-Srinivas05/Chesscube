import mongoose from 'mongoose';

// Hit counters for the rate limits that must survive a restart (sign-in, sign-up, codes). _id is
// "<limiter>:<hashed key>", so no email address or IP is stored. Deleted by MongoDB after resetAt.
const rateLimitHitSchema = new mongoose.Schema(
  {
    _id: { type: String },
    hits: { type: Number, required: true },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false }
);

rateLimitHitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitHit = mongoose.model('RateLimitHit', rateLimitHitSchema);

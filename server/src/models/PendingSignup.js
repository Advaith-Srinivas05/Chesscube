import mongoose from 'mongoose';

// A sign-up waiting for its email code. No User exists until the code is entered; MongoDB deletes the
// document once expiresAt passes (the TTL monitor runs about once a minute, so always check expiresAt too).
const pendingSignupSchema = new mongoose.Schema({
  username: { type: String, required: true },
  usernameLower: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, unique: true },
  passwordHash: { type: String, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sends: { type: Number, default: 1 },
  // The email already belongs to an account: its owner is told so instead of receiving a code.
  existingAccount: { type: Boolean, default: undefined },
  startedAt: { type: Date }, // when this sign-up was submitted; limits how long it holds the username
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingSignup = mongoose.model('PendingSignup', pendingSignupSchema);

import mongoose from 'mongoose';

// One-time codes for existing users: password resets and email changes. Deleted by MongoDB after expiresAt.
const emailCodeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: ['reset', 'email'], required: true },
  newEmail: { type: String }, // purpose 'email': the address the code was sent to
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

emailCodeSchema.index({ userId: 1, purpose: 1 }, { unique: true });
emailCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailCode = mongoose.model('EmailCode', emailCodeSchema);

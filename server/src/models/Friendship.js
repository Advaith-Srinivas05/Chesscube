import mongoose from 'mongoose';

// One document per pair of users, in either direction: a pending request that becomes the friendship once accepted.
const friendshipSchema = new mongoose.Schema(
  {
    // The two user ids sorted and joined with '_'; unique, so a pair can never have two documents.
    pair: { type: String, required: true, unique: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

friendshipSchema.index({ to: 1, status: 1 });
friendshipSchema.index({ from: 1, status: 1 });

export function pairKey(a, b) {
  return [String(a), String(b)].sort().join('_');
}

export const Friendship = mongoose.model('Friendship', friendshipSchema);

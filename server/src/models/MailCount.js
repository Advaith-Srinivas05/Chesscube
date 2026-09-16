import mongoose from 'mongoose';

// Emails sent per UTC day: _id "day:<YYYY-MM-DD>" for the total, "to:<hashed address>:<YYYY-MM-DD>" per recipient.
// Deleted by MongoDB after expiresAt.
const mailCountSchema = new mongoose.Schema(
  {
    _id: { type: String },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

mailCountSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MailCount = mongoose.model('MailCount', mailCountSchema);

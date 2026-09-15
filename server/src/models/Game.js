import mongoose from 'mongoose';

// Registered games only (guest games live in memory). Kept compact: moves are one UCI string and only the
// last known clocks are stored. The same document is written during play and becomes the finished record.
const sideSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number }, // before the game
    diff: { type: Number },
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    _id: { type: String },
    variant: { type: String, enum: ['standard', 'chess960'], required: true },
    initialFen: { type: String }, // Chess960 only
    category: { type: String, required: true },
    tc: { type: new mongoose.Schema({ base: Number, inc: Number }, { _id: false }), required: true },
    rated: { type: Boolean, default: false },
    players: { type: [mongoose.Schema.Types.ObjectId], required: true },
    white: { type: sideSchema, required: true },
    black: { type: sideSchema, required: true },
    moves: { type: String, default: '' },
    status: { type: String, enum: ['active', 'ended'], required: true },
    result: { type: String, enum: ['1-0', '0-1', '1/2-1/2'] },
    termination: { type: String },
    clock: { type: new mongoose.Schema({ w: Number, b: Number }, { _id: false }) },
    turnStartedAt: { type: Date },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
  },
  { versionKey: false }
);

gameSchema.index({ players: 1, endedAt: -1 });
gameSchema.index({ status: 1 }, { partialFilterExpression: { status: 'active' } });

export const Game = mongoose.model('Game', gameSchema);

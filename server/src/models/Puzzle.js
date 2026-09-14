import mongoose from 'mongoose';

// A subset of the Lichess puzzle database (CC0). `fen` is the position before the opponent's move;
// moves[0] is that move and the solver plays the moves at odd indexes.
const puzzleSchema = new mongoose.Schema(
  {
    _id: { type: String }, // Lichess puzzle id
    fen: { type: String, required: true },
    moves: { type: String, required: true }, // space-separated UCI
    rating: { type: Number, required: true },
    rd: { type: Number, required: true },
    plays: { type: Number, default: 0 },
    themes: { type: String, default: '' }, // space-separated Lichess theme ids
  },
  { versionKey: false }
);

puzzleSchema.index({ rating: 1 });

export const Puzzle = mongoose.model('Puzzle', puzzleSchema);

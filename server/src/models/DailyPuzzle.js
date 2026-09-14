import mongoose from 'mongoose';

// One document per UTC day: _id 'YYYY-MM-DD' → puzzle id.
const dailyPuzzleSchema = new mongoose.Schema(
  {
    _id: { type: String },
    puzzleId: { type: String, required: true },
  },
  { versionKey: false }
);

export const DailyPuzzle = mongoose.model('DailyPuzzle', dailyPuzzleSchema);

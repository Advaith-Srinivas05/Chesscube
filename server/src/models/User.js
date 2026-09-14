import mongoose from 'mongoose';
import { PROVISIONAL_RD } from '../lib/glicko2.js';
import { effectiveStreak } from '../services/dailyPuzzle.js';
import { randomAvatarId } from '../shared/avatars.js';

// Glicko-2 state per category, with short keys because every user document carries six of them:
// r = rating, rd = rating deviation, vol = volatility, n = rated games (or puzzles) played.
function ratingSchema(startRating) {
  return {
    type: new mongoose.Schema(
      {
        r: { type: Number, default: startRating },
        rd: { type: Number, default: 350 },
        vol: { type: Number, default: 0.06 },
        n: { type: Number, default: 0 },
      },
      { _id: false }
    ),
    default: () => ({}),
  };
}

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    avatar: { type: String, default: randomAvatarId },
    // Part of every session token; bumping it signs the user out everywhere.
    tokenVersion: { type: Number, default: 0 },
    ratings: {
      type: new mongoose.Schema(
        {
          bullet: ratingSchema(800),
          blitz: ratingSchema(800),
          rapid: ratingSchema(800),
          classical: ratingSchema(800),
          chess960: ratingSchema(800),
          puzzle: ratingSchema(1000),
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    puzzle: {
      type: new mongoose.Schema(
        {
          current: { type: String },
          streak: { type: Number, default: 0 },
          best: { type: Number, default: 0 },
          lastDaily: { type: Number }, // UTC day number of the last solved daily puzzle
          recent: { type: [String], default: undefined },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    lessons: { type: [String], default: undefined },
  },
  { timestamps: true }
);

userSchema.pre('validate', function setUsernameLower() {
  if (this.username) this.usernameLower = this.username.toLowerCase();
});

function publicRatings(ratings) {
  const result = {};
  for (const [category, { r, rd, n }] of Object.entries(ratings.toObject?.() ?? ratings)) {
    result[category] = { rating: Math.round(r), rd: Math.round(rd), games: n, provisional: rd > PROVISIONAL_RD };
  }
  return result;
}

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this.id,
    username: this.username,
    avatar: this.avatar,
    ratings: publicRatings(this.ratings),
    // The effective streak: already 0 once too many days were missed.
    puzzle: { streak: effectiveStreak(this.puzzle), best: this.puzzle?.best ?? 0 },
    createdAt: this.createdAt,
  };
};

userSchema.methods.toSelf = function toSelf() {
  return {
    ...this.toPublic(),
    email: this.email,
    hasPassword: Boolean(this.passwordHash),
    googleLinked: Boolean(this.googleId),
    lessons: this.lessons ?? [],
  };
};

export const User = mongoose.model('User', userSchema);

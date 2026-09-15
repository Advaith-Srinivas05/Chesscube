import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { optionalAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { friendsRouter } from './routes/friends.js';
import { gamesRouter } from './routes/games.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { puzzlesRouter } from './routes/puzzles.js';
import { usersRouter } from './routes/users.js';

const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Only JSON bodies are accepted. With SameSite=Lax cookies this blocks cross-site form posts (CSRF).
function requireJson(req, res, next) {
  if (!BODY_METHODS.has(req.method)) return next();
  const length = req.headers['content-length'];
  const hasBody = req.headers['transfer-encoding'] !== undefined || (length !== undefined && Number(length) > 0);
  if (hasBody && !req.is('application/json')) {
    return res.status(415).json({ message: 'Request body must be JSON' });
  }
  next();
}

export function createApp() {
  const app = express();

  // In production requests arrive through Vercel's rewrite and Koyeb's edge, so req.ip comes from
  // X-Forwarded-For. Someone calling the API host directly could spoof it; acceptable for rate limiting here.
  if (env.isProd) app.set('trust proxy', true);

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(requireJson);
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api', optionalAuth);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/puzzles', puzzlesRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/games', gamesRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

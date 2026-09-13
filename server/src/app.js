import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';

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

  app.use(cors({ origin: env.clientOrigins }));
  app.use(cookieParser());
  app.use(requireJson);
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Feature routers are mounted here as /api/<name>, before notFound.

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

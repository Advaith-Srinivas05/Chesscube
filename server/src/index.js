import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { persistActiveGames, restoreGames } from './realtime/games.js';
import { initRealtime } from './realtime/io.js';
import { verifyMailer } from './services/mailer.js';
import { startStorageGuard } from './services/storageGuard.js';

// One line each, so a stray rejection or exception shows up in the host's logs instead of passing silently.
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

await mongoose.connect(env.mongoUri);
console.log('Connected to MongoDB');

const server = http.createServer(createApp());
const io = initRealtime(server);
await restoreGames();

server.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
  if (env.isProd) verifyMailer();
  startStorageGuard();
});

// Saves live games before exiting so a restart can resume them.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 8000).unref();
  try {
    await persistActiveGames();
    await new Promise((resolve) => io.close(() => resolve())); // also closes the HTTP server
    await mongoose.disconnect();
  } catch (err) {
    console.error('Shutdown failed:', err);
    process.exit(1);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

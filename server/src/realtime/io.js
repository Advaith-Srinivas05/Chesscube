import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { resolveClientIp } from '../lib/clientIp.js';
import { User } from '../models/User.js';
import { verifyPurposeToken } from '../services/tokens.js';
import { incomingFor, registerChallengeHandlers } from './challenges.js';
import { identityRoom, setIo, trackSocket } from './connections.js';
import { listen } from './events.js';
import { activeGameCount, activeGameOf, registerGameHandlers } from './games.js';
import { ownSeekOf, registerLobbyHandlers } from './lobby.js';
import { limitEvents } from './rateLimit.js';
import './presence.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATS_INTERVAL_MS = 5000;
// Open sockets allowed per IP. Each tab uses one; a household or campus network shares an IP.
export const MAX_SOCKETS_PER_IP = 20;

const socketsPerIp = new Map(); // ip -> open socket count

// Guest-1234: four digits derived from the guest id, so a guest keeps the same name across visits.
export function guestName(guestId) {
  const hash = crypto.createHash('sha256').update(guestId.toLowerCase()).digest();
  return `Guest-${1000 + (hash.readUInt32BE(0) % 9000)}`;
}

// Guests can invent any number of ids, so connections are also capped per IP.
function limitPerIp(socket, next) {
  const { ip } = resolveClientIp(socket.handshake.headers, socket.handshake.address, env);
  if ((socketsPerIp.get(ip) ?? 0) >= MAX_SOCKETS_PER_IP) return next(new Error('too_many_connections'));
  socket.data.ip = ip;
  socketsPerIp.set(ip, (socketsPerIp.get(ip) ?? 0) + 1);
  socket.on('disconnect', () => {
    const left = (socketsPerIp.get(ip) ?? 1) - 1;
    if (left > 0) socketsPerIp.set(ip, left);
    else socketsPerIp.delete(ip);
  });
  next();
}

// Users send a 60-second token from GET /api/auth/socket-token; guests send the random id kept in their browser.
async function identify(socket, next) {
  try {
    const { token, guestId } = socket.handshake.auth ?? {};
    if (token) {
      const payload = verifyPurposeToken(token, 'socket');
      const user =
        payload && mongoose.isValidObjectId(payload.sub)
          ? await User.findById(payload.sub).select('username avatar tokenVersion').lean()
          : null;
      if (!user || user.tokenVersion !== payload.tv) return next(new Error('unauthorized'));
      socket.data.identity = { kind: 'user', id: String(user._id), username: user.username, avatar: user.avatar };
      return next();
    }
    if (typeof guestId === 'string' && UUID_RE.test(guestId)) {
      const id = guestId.toLowerCase();
      socket.data.identity = { kind: 'guest', id: `g_${id}`, username: guestName(id), avatar: null };
      return next();
    }
    next(new Error('unauthorized'));
  } catch (err) {
    console.error('Socket handshake failed:', err);
    next(new Error('unavailable'));
  }
}

export function initRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins },
    transports: ['websocket'],
    pingInterval: 10000,
    pingTimeout: 10000,
    maxHttpBufferSize: 16 * 1024,
  });
  setIo(io);
  io.use(identify);
  io.use(limitPerIp);

  const stats = () => ({ online: io.engine.clientsCount, games: activeGameCount() });

  io.on('connection', (socket) => {
    const { identity } = socket.data;
    limitEvents(socket);
    socket.join(identityRoom(identity));
    trackSocket(socket);
    registerGameHandlers(socket);
    registerLobbyHandlers(socket);
    registerChallengeHandlers(socket);

    // Sockets on the Play page receive live stats.
    listen(socket, 'play:subscribe', null, () => {
      socket.join('play');
      return { stats: stats() };
    });
    listen(socket, 'play:unsubscribe', null, () => {
      socket.leave('play');
    });

    socket.emit('session:identity', { kind: identity.kind, username: identity.username, avatar: identity.avatar });
    socket.emit('session:activeGame', { id: activeGameOf(identity.id) });
    socket.emit('lobby:own', { seek: ownSeekOf(identity.id) });
    if (identity.kind === 'user') for (const challenge of incomingFor(identity.id)) socket.emit('challenge:incoming', challenge);
  });

  setInterval(() => {
    if (io.sockets.adapter.rooms.get('play')?.size) io.to('play').emit('stats', stats());
  }, STATS_INTERVAL_MS).unref();

  return io;
}

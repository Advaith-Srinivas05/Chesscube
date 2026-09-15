import { io } from 'socket.io-client';
import { api } from './api.js';

const GUEST_KEY = 'guestId';
const IDLE_DISCONNECT_MS = 30_000;
const RETRY_REFUSED_MS = 3000;
const ACK_TIMEOUT_MS = 10_000;

let memoryGuestId = null;

// Random id that identifies a guest to the game server; kept so a reload returns to the same games.
function guestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    memoryGuestId ??= crypto.randomUUID();
    return memoryGuestId;
  }
}

let auth = { ready: false, userId: null };

// One shared connection, straight to the API origin. The auth callback runs on every (re)connect,
// so signed-in users always present a fresh 60-second token.
export const socket = io(import.meta.env.VITE_API_URL, {
  autoConnect: false,
  transports: ['websocket'],
  auth: (cb) => {
    if (!auth.userId) return cb({ guestId: guestId() });
    api
      .get('/auth/socket-token')
      .then(({ token }) => cb({ token }))
      .catch(() => cb({}));
  },
});

// ---- Store for React: connection status plus what the server tells us about this identity ----

let state = {
  consumers: 0,
  status: 'idle', // 'idle' | 'connecting' | 'connected' | 'reconnecting'
  connectingSince: null,
  identity: null, // { kind, username, avatar }
  activeGameId: null,
  ownSeek: null, // the player's open lobby game (quick pairing requests included)
};
const listeners = new Set();

function update(changes) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

export function subscribeSocketState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSocketState = () => state;

let idleTimer = null;
let retryTimer = null;

function sync() {
  if (state.consumers > 0 && auth.ready && !socket.active) {
    if (state.status === 'idle') update({ status: 'connecting', connectingSince: Date.now() });
    socket.connect();
  }
}

socket.on('connect', () => update({ status: 'connected', connectingSince: null }));
socket.on('disconnect', (reason) => {
  // Our own disconnect (idle or an account change) isn't a dropped connection.
  if (reason === 'io client disconnect') update({ status: 'idle', identity: null, activeGameId: null, ownSeek: null });
  else update({ status: 'reconnecting' });
});
socket.on('connect_error', () => {
  // A refused handshake (e.g. the token request failed) isn't retried by Socket.IO itself.
  if (!socket.active) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(sync, RETRY_REFUSED_MS);
  }
});
socket.on('session:identity', (identity) => update({ identity }));
socket.on('session:activeGame', ({ id }) => update({ activeGameId: id }));
socket.on('lobby:own', ({ seek }) => update({ ownSeek: seek }));

// Called by AuthContext. Signing in or out reconnects as the new identity.
export function setSocketAuth({ ready, userId }) {
  const changed = auth.ready && ready && auth.userId !== userId;
  auth = { ready, userId };
  if (changed && socket.active) {
    socket.disconnect();
    update({ status: 'connecting', connectingSince: Date.now() });
  }
  sync();
}

// Reference-counted: returns a release function. The connection closes 30 s after the last consumer leaves.
export function retainSocket() {
  clearTimeout(idleTimer);
  update({ consumers: state.consumers + 1 });
  sync();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    update({ consumers: state.consumers - 1 });
    if (state.consumers === 0) {
      idleTimer = setTimeout(() => {
        if (state.consumers === 0) socket.disconnect();
      }, IDLE_DISCONNECT_MS);
    }
  };
}

// Emits with an ack. Always resolves: { ok: true, ... } or { ok: false, message }.
export function request(event, payload = {}) {
  return new Promise((resolve) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, response) => {
      if (err) resolve({ ok: false, message: 'No response from the server, try again' });
      else resolve(response ?? { ok: false, message: 'No response from the server' });
    });
  });
}

// Which sockets each identity has open, so features can react once someone has fully gone.

export const GONE_GRACE_MS = 5000;

let io = null;
const socketsByIdentity = new Map(); // identity id -> Set of socket ids
const goneListeners = [];

export function setIo(server) {
  io = server;
}

export function getIo() {
  return io;
}

export const populationOf = (identity) => (identity.kind === 'user' ? 'users' : 'guests');

// user:<ObjectId> or guest:g_<uuid>
export const identityRoom = (identityOrId) =>
  typeof identityOrId === 'string'
    ? `${identityOrId.startsWith('g_') ? 'guest' : 'user'}:${identityOrId}`
    : `${identityOrId.kind}:${identityOrId.id}`;

export function isOnline(identityId) {
  return (socketsByIdentity.get(identityId)?.size ?? 0) > 0;
}

// fn(identityId) runs when an identity has had no sockets for GONE_GRACE_MS.
export function onIdentityGone(fn) {
  goneListeners.push(fn);
}

export function trackSocket(socket) {
  const { id } = socket.data.identity;
  if (!socketsByIdentity.has(id)) socketsByIdentity.set(id, new Set());
  socketsByIdentity.get(id).add(socket.id);

  socket.on('disconnect', () => {
    const sockets = socketsByIdentity.get(id);
    sockets?.delete(socket.id);
    if (sockets?.size) return;
    socketsByIdentity.delete(id);
    setTimeout(() => {
      if (isOnline(id)) return;
      for (const listener of goneListeners) listener(id);
    }, GONE_GRACE_MS).unref();
  });
}

export function disconnectUser(userId) {
  io?.in(identityRoom(String(userId))).disconnectSockets(true);
}

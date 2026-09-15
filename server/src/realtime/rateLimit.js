// Per-socket token bucket: `rate` events per second on average with bursts up to `burst`.
export const EVENT_RATE = 20;
export const EVENT_BURST = 40;

export function createTokenBucket({ rate = EVENT_RATE, burst = EVENT_BURST, now = Date.now } = {}) {
  let tokens = burst;
  let last = now();
  return function take() {
    const current = now();
    tokens = Math.min(burst, tokens + ((current - last) / 1000) * rate);
    last = current;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

// Socket.IO middleware for every incoming event: a socket that runs out of tokens is disconnected.
export function limitEvents(socket, options) {
  const take = createTokenBucket(options);
  socket.use((packet, next) => {
    if (take()) return next();
    const { identity } = socket.data;
    console.warn(`Socket ${socket.id} (${identity?.kind ?? 'unknown'} ${identity?.id ?? ''}) exceeded the event rate; disconnecting`);
    socket.disconnect(true);
  });
}

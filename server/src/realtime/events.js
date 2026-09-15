// An error whose message is safe to send back to the client in the ack.
export class EventError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Registers a client → server event. The payload is validated with `schema` (zod, optional) and the
 * ack always receives { ok: true, ...returned } or { ok: false, message, code? }.
 */
export function listen(socket, event, schema, handler) {
  socket.on(event, async (...args) => {
    const ack = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
    let payload = args[0] ?? {};
    if (schema) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid request' });
      payload = parsed.data;
    }
    try {
      const result = await handler(payload);
      ack({ ok: true, ...result });
    } catch (err) {
      if (err instanceof EventError) return ack({ ok: false, message: err.message, code: err.code });
      console.error(`Socket event ${event} failed:`, err);
      ack({ ok: false, message: 'Something went wrong, try again' });
    }
  });
}

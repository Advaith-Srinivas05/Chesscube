import { ZodError } from 'zod';

// `extra` adds fields to the JSON response, e.g. { retryAfter: 42 }.
export class HttpError extends Error {
  constructor(status, message, code, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function notFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

// Express 5 forwards errors thrown in async handlers here.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const body = { ...err.extra, message: err.message };
    if (err.code) body.code = err.code;
    if (err.field) body.field = err.field;
    return res.status(err.status).json(body);
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ message: issue?.message ?? 'Invalid input', field: issue?.path.join('.') || undefined });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }
  // Unique index race (e.g. two sign-ups for the same username at once).
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0]?.replace(/Lower$/, '');
    return res.status(409).json({ message: `That ${field ?? 'value'} is already taken`, field });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large' });
  }
  // The path without its query string, which can hold an email address.
  console.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

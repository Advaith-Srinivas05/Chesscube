import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

// Express 5 forwards errors thrown in async handlers here.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    const body = { message: err.message };
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
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large' });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
}

import { HttpError } from './errors.js';

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const error = new HttpError(400, issue.message);
  error.field = issue.path.join('.') || undefined;
  throw error;
}

// Express 5's req.query is a read-only getter, so parsed query values go on req.validatedQuery.
export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    if (params) req.params = parse(params, req.params);
    if (query) req.validatedQuery = parse(query, req.query);
    if (body) req.body = parse(body, req.body ?? {});
    next();
  };
}

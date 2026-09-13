import rateLimit from 'express-rate-limit';

export function limiter({ windowMs, limit, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many attempts, try again later' },
    ...(keyGenerator && { keyGenerator }),
  });
}

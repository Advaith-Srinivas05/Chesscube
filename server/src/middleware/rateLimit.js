import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export { ipKeyGenerator };

export function limiter({ windowMs, limit, keyGenerator, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: { message: 'Too many attempts, try again later' },
    // 'trust proxy' is deliberately permissive in production (see app.js).
    validate: { trustProxy: false },
    ...(keyGenerator && { keyGenerator }),
  });
}

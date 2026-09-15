function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

// Session and socket tokens are HMAC-signed with this; a short secret can be brute-forced.
const JWT_SECRET_MIN_BYTES = 32;
const jwtSecret = required('JWT_SECRET');
if (Buffer.byteLength(jwtSecret) < JWT_SECRET_MIN_BYTES) {
  throw new Error(`JWT_SECRET must be at least ${JWT_SECRET_MIN_BYTES} bytes (see .env.example for a generator)`);
}
const isProd = nodeEnv === 'production';

const smtpUser = process.env.SMTP_USER?.trim() || null;
// Google shows app passwords in groups of four; the spaces aren't part of it.
const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, '') || null;

// Without SMTP credentials emails are logged to the console, which is only acceptable in development.
if (isProd && (!smtpUser || !smtpPass)) {
  throw new Error('SMTP_USER and SMTP_PASS are required when NODE_ENV=production');
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  smtpUser,
  smtpPass,
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

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

// Email goes out through one of two Gmail routes:
// - the Gmail API over HTTPS (production: free hosts such as Render block the SMTP ports), or
// - SMTP with an app password (handy locally).
// With neither, emails are logged to the console, which is only acceptable in development.
const GMAIL_API_VARS = ['GMAIL_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
const gmailValues = GMAIL_API_VARS.map((name) => process.env[name]?.trim() || null);
const gmailSet = gmailValues.filter(Boolean).length;
if (gmailSet > 0 && gmailSet < GMAIL_API_VARS.length) {
  const missing = GMAIL_API_VARS.filter((_, index) => !gmailValues[index]);
  throw new Error(`Gmail API email is partly configured; also set ${missing.join(', ')}`);
}
const gmailApi = gmailSet
  ? { user: gmailValues[0], clientId: gmailValues[1], clientSecret: gmailValues[2], refreshToken: gmailValues[3] }
  : null;

const smtpUser = process.env.SMTP_USER?.trim() || null;
// Google shows app passwords in groups of four; the spaces aren't part of it.
const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, '') || null;
const smtp = smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : null;

if (isProd && !gmailApi && !smtp) {
  throw new Error('Email is required in production: set GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN (or SMTP_USER and SMTP_PASS)');
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  gmailApi,
  smtp,
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

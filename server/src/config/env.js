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

// Email goes out from the owner's Gmail account through one of two routes:
// - a Google Apps Script web app called over HTTPS (production: free hosts such as Render block the SMTP ports), or
// - SMTP with an app password (handy locally).
// With neither, emails are logged to the console, which is only acceptable in development.
const MAIL_SCRIPT_SECRET_MIN = 32;
const scriptUrl = process.env.MAIL_SCRIPT_URL?.trim() || null;
const scriptSecret = process.env.MAIL_SCRIPT_SECRET?.trim() || null;
if (Boolean(scriptUrl) !== Boolean(scriptSecret)) {
  throw new Error('Set both MAIL_SCRIPT_URL and MAIL_SCRIPT_SECRET, or neither');
}
if (scriptUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(scriptUrl)) {
  throw new Error('MAIL_SCRIPT_URL must be the web app URL from Apps Script (https://script.google.com/macros/s/…/exec)');
}
if (scriptSecret && scriptSecret.length < MAIL_SCRIPT_SECRET_MIN) {
  throw new Error(`MAIL_SCRIPT_SECRET must be at least ${MAIL_SCRIPT_SECRET_MIN} characters`);
}
const mailScript = scriptUrl ? { url: scriptUrl, secret: scriptSecret } : null;

const smtpUser = process.env.SMTP_USER?.trim() || null;
// Google shows app passwords in groups of four; the spaces aren't part of it.
const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, '') || null;
const smtp = smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : null;

if (isProd && !mailScript && !smtp) {
  throw new Error('Email is required in production: set MAIL_SCRIPT_URL and MAIL_SCRIPT_SECRET (or SMTP_USER and SMTP_PASS)');
}

// The Vercel middleware (client/middleware.js) sends the real client IP with this shared secret. Anyone can call the
// API host directly with a made-up X-Forwarded-For, so without it rate limits could be dodged by changing that header.
const PROXY_SECRET_MIN = 32;
const proxySecret = process.env.PROXY_SECRET?.trim() || null;
if (proxySecret && proxySecret.length < PROXY_SECRET_MIN) {
  throw new Error(`PROXY_SECRET must be at least ${PROXY_SECRET_MIN} characters`);
}
if (isProd && !proxySecret) {
  throw new Error('PROXY_SECRET is required in production (the same value as PROXY_SECRET on Vercel)');
}

// How many X-Forwarded-For entries the host's own proxies append, for requests that come straight to the API
// (sockets), when CF-Connecting-IP is missing. 0 ignores the header. GET /api/health/ip shows what was picked.
const proxyHops = Number(process.env.PROXY_HOPS ?? (isProd ? 1 : 0));
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) {
  throw new Error('PROXY_HOPS must be a whole number from 0 to 5');
}

// Apps Script on a personal Gmail account can send to about 100 recipients a day; stay below that.
const mailDailyLimit = Number(process.env.MAIL_DAILY_LIMIT ?? 90);
if (!Number.isInteger(mailDailyLimit) || mailDailyLimit < 1) {
  throw new Error('MAIL_DAILY_LIMIT must be a positive whole number');
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  mongoUri: required('MONGODB_URI'),
  jwtSecret,
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  mailScript,
  smtp,
  mailDailyLimit,
  proxySecret,
  proxyHops,
  // Cloudflare (in front of Render) sets CF-Connecting-IP and rejects requests that try to send their own.
  trustCloudflare: isProd,
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

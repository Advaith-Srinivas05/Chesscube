function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

const smtpUser = process.env.SMTP_USER || null;
const smtpPass = process.env.SMTP_PASS || null;

// Without SMTP credentials emails are logged to the console, which is only acceptable in development.
if (isProd && (!smtpUser || !smtpPass)) {
  throw new Error('SMTP_USER and SMTP_PASS are required when NODE_ENV=production');
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  smtpUser,
  smtpPass,
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

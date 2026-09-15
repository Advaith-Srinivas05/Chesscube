import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// Builds the raw MIME message only; the Gmail API route sends it over HTTPS.
const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });

function gmailApiTransport({ user, clientId, clientSecret, refreshToken }) {
  const client = new OAuth2Client({ clientId, clientSecret });
  client.setCredentials({ refresh_token: refreshToken });
  return {
    name: 'Gmail API',
    from: user,
    // Exchanging the refresh token proves the credentials work without sending anything.
    verify: () => client.getAccessToken(),
    async send(message) {
      const { message: raw } = await composer.sendMail(message);
      await client.request({ url: GMAIL_SEND_URL, method: 'POST', data: { raw: raw.toString('base64url') } });
    },
  };
}

function smtpTransport({ user, pass }) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
  });
  return {
    name: 'SMTP',
    from: user,
    verify: () => transporter.verify(),
    send: (message) => transporter.sendMail(message),
  };
}

const transport = env.gmailApi ? gmailApiTransport(env.gmailApi) : env.smtp ? smtpTransport(env.smtp) : null;

// Error messages can quote recipient addresses, so logs get only codes and statuses.
export function mailErrorSummary(err) {
  const apiError = err.response?.data?.error;
  const detail = typeof apiError === 'string' ? apiError : apiError?.status;
  const parts = new Set([err.code, err.responseCode, err.response?.status, detail].filter(Boolean).map(String));
  return [...parts].join(' ') || err.name || 'unknown error';
}

// Called once at startup in production; logs instead of throwing so a mail outage doesn't stop the API.
export async function verifyMailer() {
  if (!transport) return;
  try {
    await transport.verify();
    console.log(`Email via ${transport.name} verified`);
  } catch (err) {
    console.error(`Email via ${transport.name} verification failed:`, mailErrorSummary(err));
  }
}

export async function sendMail({ to, subject, text, html }) {
  if (!transport) {
    // Only reachable in development: env.js refuses to start in production without email credentials.
    console.log(`\n--- Email (not configured) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-----------------------------------\n`);
    return;
  }
  await transport.send({ from: `"Chesscube" <${transport.from}>`, to, subject, text, html });
}

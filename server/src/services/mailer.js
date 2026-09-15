import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const SCRIPT_TIMEOUT_MS = 20_000;

// Posts to a Google Apps Script web app that sends the email with MailApp from the owner's Gmail account. Works over
// HTTPS, so it runs on hosts that block the SMTP ports. The script replies { ok } with HTTP 200 even on failure.
function appsScriptTransport({ url, secret }) {
  async function call(payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, ...payload }),
      redirect: 'follow', // Apps Script answers through a redirect to googleusercontent.com
      signal: AbortSignal.timeout(SCRIPT_TIMEOUT_MS),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // An HTML page means the script crashed, isn't deployed for "Anyone", or hit its quota.
    }
    if (!res.ok || !data?.ok) {
      const error = new Error('Apps Script mail request failed');
      error.code = data?.error ?? (res.ok ? 'SCRIPT_NOT_JSON' : `HTTP_${res.status}`);
      throw error;
    }
    return data;
  }
  return {
    name: 'Apps Script',
    // The script checks the secret and returns without sending anything.
    verify: () => call({ ping: true }),
    send: ({ to, subject, text, html }) => call({ to, subject, text, html, name: 'Chesscube' }),
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
    verify: () => transporter.verify(),
    send: (message) => transporter.sendMail({ from: `"Chesscube" <${user}>`, ...message }),
  };
}

const transport = env.mailScript ? appsScriptTransport(env.mailScript) : env.smtp ? smtpTransport(env.smtp) : null;

// Error messages can quote recipient addresses, so logs get only codes and statuses.
export function mailErrorSummary(err) {
  const parts = new Set([err.code, err.responseCode].filter(Boolean).map(String));
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
  await transport.send({ to, subject, text, html });
}

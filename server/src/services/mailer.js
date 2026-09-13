import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter =
  env.smtpUser && env.smtpPass
    ? nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: env.smtpUser, pass: env.smtpPass },
      })
    : null;

// Called once at startup in production; logs instead of throwing so a mail outage doesn't stop the API.
export async function verifyMailer() {
  if (!transporter) return;
  try {
    await transporter.verify();
    console.log('SMTP connection verified');
  } catch (err) {
    console.error('SMTP verification failed:', err.message);
  }
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    // Only reachable in development: env.js refuses to start in production without SMTP credentials.
    console.log(`\n--- Email (SMTP not configured) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-----------------------------------\n`);
    return;
  }
  await transporter.sendMail({ from: `"Chesscube" <${env.smtpUser}>`, to, subject, text, html });
}

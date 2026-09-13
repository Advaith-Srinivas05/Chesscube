// Usage: node --env-file=.env scripts/sendTestEmail.js you@example.com
import { verificationEmail } from '../src/services/emailTemplates.js';
import { sendMail } from '../src/services/mailer.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node --env-file=.env scripts/sendTestEmail.js <to>');
  process.exit(1);
}

await sendMail({ to, ...verificationEmail({ username: 'Tester', code: '123456' }) });
console.log(`Sent a sample verification email to ${to}`);

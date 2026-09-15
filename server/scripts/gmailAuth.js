// One-time: authorises the sending Gmail account and prints GMAIL_REFRESH_TOKEN.
// Needs GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET (an OAuth client of type "Desktop app") in .env.
// Usage: npm run gmail:auth
import http from 'node:http';
import { OAuth2Client } from 'google-auth-library';

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const clientId = process.env.GMAIL_CLIENT_ID?.trim();
const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in server/.env first (Desktop app OAuth client).');
  process.exit(1);
}

// Desktop clients may redirect to any loopback port.
const server = http.createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const redirectUri = `http://127.0.0.1:${server.address().port}`;
const client = new OAuth2Client({ clientId, clientSecret, redirectUri });

const authUrl = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [SCOPE] });
console.log('\nOpen this link, sign in with the Gmail account that should send Chesscube emails, and allow access:\n');
console.log(authUrl, '\n');

server.on('request', async (req, res) => {
  const url = new URL(req.url, redirectUri);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  if (error) {
    res.end(`Authorisation failed: ${error}. You can close this tab.`);
    console.error(`Authorisation failed: ${error}`);
    server.close();
    process.exitCode = 1;
    return;
  }
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) throw new Error('Google returned no refresh token; run the script again');
    res.end('Done. Go back to the terminal and copy the refresh token. You can close this tab.');
    console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\nPut that line in server/.env (locally) and in the host\'s environment variables. Keep it secret.');
  } catch (err) {
    res.end('Exchanging the code failed. Check the terminal.');
    console.error('Exchanging the code failed:', err.response?.data?.error ?? err.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

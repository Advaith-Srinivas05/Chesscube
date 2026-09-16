import { ipAddress, next } from '@vercel/functions';

// Vercel Routing Middleware (runs on Vercel only, never in the browser bundle). API requests reach Render through the
// /api rewrite in vercel.json, but Render can't tell those apart from requests sent to it directly with a made-up
// X-Forwarded-For. So the visitor's real IP travels in a header proven by a secret shared with the API
// (PROXY_SECRET, set on both Vercel and Render), and rate limits can't be dodged by changing that header.
export const config = {
  matcher: '/api/:path*',
};

const SECRET_HEADER = 'x-chesscube-proxy-secret';
const CLIENT_IP_HEADER = 'x-chesscube-client-ip';

export default function middleware(request) {
  const headers = new Headers(request.headers);
  // Never pass on values a visitor sent themselves.
  headers.delete(SECRET_HEADER);
  headers.delete(CLIENT_IP_HEADER);

  const secret = process.env.PROXY_SECRET;
  const ip = ipAddress(request);
  if (secret && ip) {
    headers.set(SECRET_HEADER, secret);
    headers.set(CLIENT_IP_HEADER, ip);
  }
  return next({ request: { headers } });
}

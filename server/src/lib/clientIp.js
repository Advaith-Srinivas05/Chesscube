import crypto from 'node:crypto';
import net from 'node:net';

// Set by client/middleware.js on Vercel for every /api request it forwards.
export const PROXY_SECRET_HEADER = 'x-chesscube-proxy-secret';
export const PROXY_CLIENT_IP_HEADER = 'x-chesscube-client-ip';

const single = (value) => (Array.isArray(value) ? value[0] : value);

function cleanIp(value) {
  const ip = String(value ?? '')
    .trim()
    .replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  return net.isIP(ip) ? ip : null;
}

// Compares digests so the check takes the same time whatever the length of the guess.
function secretMatches(given, expected) {
  if (typeof given !== 'string' || !given) return false;
  const digest = (value) => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(given), digest(expected));
}

/**
 * The IP address of whoever made the request, and where it came from:
 * - 'vercel': forwarded by our Vercel middleware, proven by the shared secret;
 * - 'cloudflare': CF-Connecting-IP, which Cloudflare sets and clients can't supply (only when trustCloudflare);
 * - 'x-forwarded-for': the entry `proxyHops` from the right, i.e. the one the host's own proxy added;
 * - 'socket': the TCP peer.
 * The leftmost X-Forwarded-For entry is never used: callers can put anything there.
 */
export function resolveClientIp(headers, remoteAddress, { proxySecret = null, proxyHops = 0, trustCloudflare = false } = {}) {
  if (proxySecret && secretMatches(single(headers[PROXY_SECRET_HEADER]), proxySecret)) {
    const ip = cleanIp(single(headers[PROXY_CLIENT_IP_HEADER]));
    if (ip) return { ip, source: 'vercel' };
  }
  if (trustCloudflare) {
    const ip = cleanIp(single(headers['cf-connecting-ip']));
    if (ip) return { ip, source: 'cloudflare' };
  }
  if (proxyHops > 0) {
    const entries = String(single(headers['x-forwarded-for']) ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const ip = entries.length >= proxyHops ? cleanIp(entries[entries.length - proxyHops]) : null;
    if (ip) return { ip, source: 'x-forwarded-for' };
  }
  return { ip: cleanIp(remoteAddress) ?? '0.0.0.0', source: 'socket' };
}

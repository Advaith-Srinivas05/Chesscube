import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PROXY_CLIENT_IP_HEADER, PROXY_SECRET_HEADER, resolveClientIp } from '../src/lib/clientIp.js';
import { guestSeeksFrom } from '../src/realtime/lobby.js';
import { RESET_GUARD_WINDOW_MS, RESET_GUESS_LIMIT, resetLocked } from '../src/services/resetGuard.js';

const SECRET = 'a'.repeat(40);
const prod = { proxySecret: SECRET, proxyHops: 1, trustCloudflare: true };

describe('client IP', () => {
  test('trusts the Vercel header only with the right secret', () => {
    const headers = { [PROXY_SECRET_HEADER]: SECRET, [PROXY_CLIENT_IP_HEADER]: '203.0.113.5', 'x-forwarded-for': '1.1.1.1, 10.0.0.1' };
    assert.deepEqual(resolveClientIp(headers, '10.0.0.2', prod), { ip: '203.0.113.5', source: 'vercel' });

    const forged = { ...headers, [PROXY_SECRET_HEADER]: 'wrong' };
    assert.deepEqual(resolveClientIp(forged, '10.0.0.2', prod), { ip: '10.0.0.1', source: 'x-forwarded-for' });
  });

  test('ignores a made-up leftmost X-Forwarded-For entry', () => {
    const headers = { 'x-forwarded-for': '6.6.6.6, 198.51.100.7' };
    assert.equal(resolveClientIp(headers, '10.0.0.2', prod).ip, '198.51.100.7');
    assert.equal(resolveClientIp(headers, '10.0.0.2', { ...prod, proxyHops: 2 }).ip, '6.6.6.6');
  });

  test('prefers CF-Connecting-IP in production only', () => {
    const headers = { 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '198.51.100.9, 172.16.0.1' };
    assert.deepEqual(resolveClientIp(headers, '10.0.0.2', prod), { ip: '198.51.100.9', source: 'cloudflare' });
    assert.deepEqual(resolveClientIp(headers, '::ffff:127.0.0.1', {}), { ip: '127.0.0.1', source: 'socket' });
  });

  test('falls back to the socket address when headers are missing or invalid', () => {
    assert.deepEqual(resolveClientIp({ 'x-forwarded-for': 'not-an-ip' }, '::1', prod), { ip: '::1', source: 'socket' });
    assert.equal(resolveClientIp({}, undefined, prod).ip, '0.0.0.0');
  });
});

describe('password reset guard', () => {
  const now = Date.now();

  test('locks after the limit within the window', () => {
    assert.equal(resetLocked(undefined, now), false);
    assert.equal(resetLocked({ guesses: RESET_GUESS_LIMIT - 1, since: new Date(now) }, now), false);
    assert.equal(resetLocked({ guesses: RESET_GUESS_LIMIT, since: new Date(now - 1000) }, now), true);
  });

  test('unlocks once the window has passed', () => {
    assert.equal(resetLocked({ guesses: 99, since: new Date(now - RESET_GUARD_WINDOW_MS - 1) }, now), false);
  });
});

describe('guest lobby cap', () => {
  const seek = (owner, ip, population = 'guests') => ({ owner: { id: owner }, ip, population });

  test("counts open guest games from the same IP, not the player's own", () => {
    const seeks = [seek('g1', '1.2.3.4'), seek('g2', '1.2.3.4'), seek('g3', '5.6.7.8'), seek('u1', '1.2.3.4', 'users')];
    assert.equal(guestSeeksFrom(seeks, '1.2.3.4', 'g9'), 2);
    assert.equal(guestSeeksFrom(seeks, '1.2.3.4', 'g1'), 1);
  });
});

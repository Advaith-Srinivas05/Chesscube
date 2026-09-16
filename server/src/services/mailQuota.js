import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';
import { MailCount } from '../models/MailCount.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAIL_PER_ADDRESS_PER_DAY = 10;

const dayKey = (now) => now.toISOString().slice(0, 10);
const hashAddress = (address) =>
  crypto.createHmac('sha256', env.jwtSecret).update(address.toLowerCase()).digest('base64url').slice(0, 22);

async function bump(id, by, expiresAt) {
  const run = () =>
    MailCount.collection.findOneAndUpdate(
      { _id: id },
      { $inc: { count: by }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: 'after' }
    );
  try {
    return (await run()).count;
  } catch (err) {
    if (err.code !== 11000) throw err;
    return (await run()).count;
  }
}

/**
 * Counts one email to `address` against the per-recipient and daily limits. Returns null when it may be sent,
 * otherwise 'address' or 'daily' (and nothing is counted). Keeps people from flooding someone's inbox with codes
 * or using up the sending quota, which would stop sign-ups and resets for everyone.
 */
export async function reserveEmail(address, now = new Date()) {
  const day = dayKey(now);
  // Kept a day past the end of the UTC day it counts.
  const expiresAt = new Date(Date.parse(day) + 2 * DAY_MS);
  const addressId = `to:${hashAddress(address)}:${day}`;
  const dailyId = `day:${day}`;

  if ((await bump(addressId, 1, expiresAt)) > MAIL_PER_ADDRESS_PER_DAY) {
    await bump(addressId, -1, expiresAt);
    return 'address';
  }
  if ((await bump(dailyId, 1, expiresAt)) > env.mailDailyLimit) {
    await Promise.all([bump(dailyId, -1, expiresAt), bump(addressId, -1, expiresAt)]);
    return 'daily';
  }
  return null;
}

export function mailLimitError(reason) {
  return reason === 'daily'
    ? new HttpError(503, "We can't send any more emails today. Try again tomorrow.", 'MAIL_DAILY_LIMIT')
    : new HttpError(429, "We've sent too many emails to this address today. Try again tomorrow.", 'MAIL_ADDRESS_LIMIT');
}

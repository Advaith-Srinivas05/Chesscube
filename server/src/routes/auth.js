import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { env } from '../config/env.js';
import { code, email, password, username } from '../lib/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { ipKeyGenerator, limiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { EmailCode } from '../models/EmailCode.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';
import { disconnectUser } from '../realtime/connections.js';
import {
  CODE_TTL_MS,
  codeIsFresh,
  codeMatches,
  cooldownRemaining,
  generateCode,
  hashCode,
  MAX_CODE_ATTEMPTS,
} from '../services/codes.js';
import { existingAccountEmail, passwordResetEmail, verificationEmail } from '../services/emailTemplates.js';
import { countIncomingRequests } from '../services/friends.js';
import { mailErrorSummary, sendMail } from '../services/mailer.js';
import { mailLimitError, reserveEmail } from '../services/mailQuota.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import { recordWrongResetGuess, resetLocked } from '../services/resetGuard.js';
import { clearSessionCookie, signIn, signPurposeToken, verifyPurposeToken } from '../services/tokens.js';
import { USERNAME_HOLD_MS, usernameTaken } from '../services/usernames.js';
import { PASSWORD_MAX, usernameIssue, USERNAME_RE } from '../shared/validation.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const PENDING_TTL_MS = 30 * MINUTE;
const MAX_SENDS = 5;
const RESEND_SECONDS = 60;

// ---- Helpers ----

const notExpired = () => ({ expiresAt: { $gt: new Date() } });

function tooSoon(seconds) {
  return new HttpError(429, `Please wait ${seconds} seconds before requesting another code`, 'COOLDOWN', {
    retryAfter: seconds,
  });
}

async function sendOrFail(message) {
  try {
    await sendMail(message);
  } catch (err) {
    console.error('Email failed:', mailErrorSummary(err));
    throw new HttpError(502, "We couldn't send the email. Try again in a moment.");
  }
}

// A sign-up for an address that already has an account gets the same response as any other; its owner is emailed a
// notice instead of a code, so the form can't be used to find out which emails are registered.
const signupEmail = (pending, newCode) =>
  pending.existingAccount ? existingAccountEmail() : verificationEmail({ username: pending.username, code: newCode });

// bcrypt work for unknown accounts too, so response times don't reveal which usernames exist.
const DUMMY_HASH = await hashPassword('timing-equaliser-Aa1');

// Every route that emails a code shares this per-IP daily budget, on top of its own limits.
const mailIpLimiter = limiter({
  windowMs: DAY,
  limit: 30,
  name: 'mail-ip',
  message: 'Too many emails requested from your network today. Try again tomorrow.',
});

// ---- Router ----

export const authRouter = Router();

authRouter.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  // incomingRequests (the navbar badge) is only sent here; the client keeps it when other routes return the user.
  res.json({ user: { ...req.user.toSelf(), incomingRequests: await countIncomingRequests(req.user._id) } });
});

// Short-lived token the Socket.IO handshake accepts; the socket connects straight to the API origin, without the cookie.
authRouter.get('/socket-token', requireAuth, (req, res) => {
  res.json({ token: signPurposeToken({ sub: req.user.id, tv: req.user.tokenVersion }, 'socket', '60s') });
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// Ends every session of the account, including stolen cookies: tokens carry tokenVersion, which no longer matches.
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  clearSessionCookie(res);
  disconnectUser(req.user._id);
  res.status(204).end();
});

authRouter.get(
  '/username-available',
  limiter({ windowMs: MINUTE, limit: 60 }),
  validate({ query: z.object({ username: z.string().default(''), email: z.string().trim().toLowerCase().optional() }) }),
  async (req, res) => {
    const { username: name, email: forEmail } = req.validatedQuery;
    const issue = usernameIssue(name.trim());
    if (issue) return res.json({ available: false, message: issue });
    // Signed in (renaming on the profile page): the user's own name, in any casing, counts as available.
    const options = { email: forEmail ?? req.user?.email, exceptUserId: req.user?._id };
    if (await usernameTaken(name.trim(), options)) {
      return res.json({ available: false, message: 'That username is taken' });
    }
    res.json({ available: true });
  }
);

// ---- Email sign-up ----

authRouter.post(
  '/signup',
  limiter({ windowMs: 60 * MINUTE, limit: 10, name: 'signup' }),
  mailIpLimiter,
  validate({ body: z.object({ username, email, password }) }),
  async (req, res) => {
    const { username: name, email: address, password: plain } = req.body;
    const usernameLower = name.toLowerCase();
    const now = new Date();

    if (await usernameTaken(name, { email: address })) {
      const error = new HttpError(409, 'That username is taken');
      error.field = 'username';
      throw error;
    }

    // Expired sign-ups, and ones whose hold on this username has lapsed, would otherwise trip the unique indexes.
    await PendingSignup.deleteMany({
      $or: [
        { email: address, expiresAt: { $lte: now } },
        { usernameLower, expiresAt: { $lte: now } },
        { usernameLower, email: { $ne: address }, startedAt: { $lte: new Date(now.getTime() - USERNAME_HOLD_MS) } },
      ],
    });

    // A new sign-up for the same address replaces the old one once the cooldown has passed, so nobody can lock an
    // address by starting sign-ups for it. The per-address email limit stops this from flooding the inbox.
    const existing = await PendingSignup.findOne({ email: address });
    const wait = cooldownRemaining(existing?.lastSentAt);
    if (wait > 0) throw tooSoon(wait);

    const limited = await reserveEmail(address);
    if (limited) throw mailLimitError(limited);

    const newCode = generateCode();
    const fields = {
      username: name,
      usernameLower,
      email: address,
      passwordHash: await hashPassword(plain),
      codeHash: hashCode(newCode),
      attempts: 0,
      sends: 1,
      existingAccount: (await User.exists({ email: address })) ? true : undefined,
      startedAt: now,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
    };

    let pending;
    if (existing) {
      existing.set(fields);
      pending = await existing.save();
    } else {
      pending = await PendingSignup.create(fields);
    }

    try {
      await sendOrFail({ to: address, ...signupEmail(pending, newCode) });
    } catch (err) {
      // The code never arrived: don't make the user wait out the cooldown.
      await PendingSignup.updateOne({ _id: pending._id }, { $set: { lastSentAt: new Date(0) } });
      throw err;
    }

    res.status(201).json({ email: address, resendIn: RESEND_SECONDS });
  }
);

authRouter.post(
  '/signup/verify',
  limiter({ windowMs: 15 * MINUTE, limit: 30, name: 'signup-verify' }),
  validate({ body: z.object({ email, code }) }),
  async (req, res) => {
    const { email: address, code: entered } = req.body;
    const pending = await PendingSignup.findOne({ email: address, ...notExpired() });
    if (!pending) throw new HttpError(400, 'Code expired, sign up again', 'SIGNUP_EXPIRED');
    if (pending.attempts >= MAX_CODE_ATTEMPTS) {
      throw new HttpError(429, 'Too many attempts, request a new code', 'TOO_MANY_ATTEMPTS');
    }

    if (!codeIsFresh(pending.lastSentAt) || !codeMatches(entered, pending.codeHash)) {
      await PendingSignup.updateOne({ _id: pending._id }, { $inc: { attempts: 1 } });
      const message = codeIsFresh(pending.lastSentAt) ? 'Incorrect code' : 'Code expired, request a new one';
      throw new HttpError(400, message, 'INVALID_CODE');
    }

    if (await User.exists({ email: pending.email })) {
      await pending.deleteOne();
      throw new HttpError(409, 'An account with this email already exists');
    }
    if (await User.exists({ usernameLower: pending.usernameLower })) {
      await pending.deleteOne();
      throw new HttpError(409, 'That username was taken in the meantime, sign up again');
    }

    const user = await User.create({ username: pending.username, email: pending.email, passwordHash: pending.passwordHash });
    await pending.deleteOne();
    signIn(res, user);
    res.status(201).json({ user: user.toSelf() });
  }
);

authRouter.post(
  '/signup/resend',
  limiter({ windowMs: 60 * MINUTE, limit: 5, name: 'signup-resend' }),
  mailIpLimiter,
  validate({ body: z.object({ email }) }),
  async (req, res) => {
    const pending = await PendingSignup.findOne({ email: req.body.email, ...notExpired() });
    if (!pending) throw new HttpError(400, 'Sign-up expired, sign up again', 'SIGNUP_EXPIRED');
    const wait = cooldownRemaining(pending.lastSentAt);
    if (wait > 0) throw tooSoon(wait);
    if (pending.sends >= MAX_SENDS) throw new HttpError(429, 'Too many codes sent. Sign up again later.');

    const limited = await reserveEmail(pending.email);
    if (limited) throw mailLimitError(limited);

    const newCode = generateCode();
    const now = new Date();
    // Conditional on lastSentAt so two simultaneous resends can't both go through.
    const updated = await PendingSignup.findOneAndUpdate(
      { _id: pending._id, lastSentAt: pending.lastSentAt },
      {
        $set: { codeHash: hashCode(newCode), attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + PENDING_TTL_MS) },
        $inc: { sends: 1 },
      },
      { returnDocument: 'after' }
    );
    if (!updated) throw tooSoon(RESEND_SECONDS);

    try {
      await sendOrFail({ to: updated.email, ...signupEmail(updated, newCode) });
    } catch (err) {
      await PendingSignup.updateOne({ _id: updated._id }, { $set: { lastSentAt: new Date(0) } });
      throw err;
    }
    res.json({ email: updated.email, resendIn: RESEND_SECONDS });
  }
);

// ---- Sign in ----

const loginKey = (req) => String(req.body?.login ?? '').trim().toLowerCase();

authRouter.post(
  '/signin',
  // Per account, whatever the IP: slows password spraying from many addresses.
  limiter({
    windowMs: 60 * MINUTE,
    limit: 30,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `login:${loginKey(req)}`,
    name: 'signin-login',
  }),
  limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${loginKey(req)}`,
    name: 'signin-ip',
  }),
  validate({
    body: z.object({
      login: z.string({ error: 'Enter your username or email' }).trim().min(1, 'Enter your username or email').max(254),
      password: z.string({ error: 'Enter your password' }).min(1, 'Enter your password').max(PASSWORD_MAX),
    }),
  }),
  async (req, res) => {
    const login = req.body.login.toLowerCase();
    const query = login.includes('@') ? { email: login } : { usernameLower: login };
    const user = await User.findOne(query);

    if (user) {
      if (user.passwordHash && (await verifyPassword(req.body.password, user.passwordHash))) {
        signIn(res, user);
        return res.json({ user: user.toSelf() });
      }
      if (!user.passwordHash) await verifyPassword(req.body.password, DUMMY_HASH);
      throw new HttpError(401, 'Incorrect username/email or password', 'BAD_CREDENTIALS');
    }

    const pending = await PendingSignup.findOne({ ...query, ...notExpired() });
    if (!(await verifyPassword(req.body.password, pending?.passwordHash ?? DUMMY_HASH)) || !pending) {
      throw new HttpError(401, 'Incorrect username/email or password', 'BAD_CREDENTIALS');
    }

    // Right password for an unverified sign-up: send a fresh code if allowed, then point them at verification.
    if (cooldownRemaining(pending.lastSentAt) === 0 && pending.sends < MAX_SENDS && !(await reserveEmail(pending.email))) {
      const newCode = generateCode();
      const now = new Date();
      pending.set({ codeHash: hashCode(newCode), attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + PENDING_TTL_MS), sends: pending.sends + 1 });
      await pending.save();
      try {
        await sendMail({ to: pending.email, ...signupEmail(pending, newCode) });
      } catch (err) {
        console.error('Email failed:', mailErrorSummary(err));
        await PendingSignup.updateOne({ _id: pending._id }, { $set: { lastSentAt: new Date(0) } });
      }
    }
    res.status(403).json({
      message: 'Verify your email to finish creating your account',
      code: 'EMAIL_NOT_VERIFIED',
      email: pending.email,
    });
  }
);

// ---- Google ----

const googleClient = new OAuth2Client();

function requireGoogle() {
  if (!env.googleClientId) throw new HttpError(503, 'Google sign-in is not configured');
}

// Google is the authority for Gmail addresses and for Workspace accounts (the `hd` claim); for any other address it
// only confirmed the email once, so an existing account with that email asks for its password before linking.
export function googleOwnsEmail({ email: address, hd }) {
  return Boolean(hd) || /@(gmail|googlemail)\.com$/i.test(address);
}

// Signs in to the account with this email if Google may link to it; otherwise the client asks for its password.
async function linkOrAskPassword(res, user, { sub, email: address, hd }) {
  if (googleOwnsEmail({ email: address, hd })) {
    user.googleId = sub;
    await user.save();
    signIn(res, user);
    return res.json({ user: user.toSelf() });
  }
  const linkToken = signPurposeToken({ sub, email: address }, 'google-link', '15m');
  res.json({ needsLink: true, linkToken, email: address });
}

// A valid, available username based on the Google name or email.
async function suggestUsername(name, address) {
  const clean = (value) =>
    String(value ?? '')
      .normalize('NFKD')
      .replace(/\p{M}/gu, '') // accents left over after NFKD
      .replace(/\s+/g, '')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .replace(/^[_-]+/, '')
      .slice(0, 16);

  let base = [clean(name), clean(address.split('@')[0])].find((candidate) => candidate.length >= 3 && !usernameIssue(candidate));
  if (!base) base = 'player';

  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? base : `${base}${i < 10 ? i : Math.floor(Math.random() * 9000) + 1000}`;
    if (USERNAME_RE.test(candidate) && !(await usernameTaken(candidate, { email: address }))) return candidate;
  }
  return `${base.slice(0, 12)}${Date.now() % 100000000}`;
}

const googleLimiter = limiter({ windowMs: 15 * MINUTE, limit: 20, name: 'google' });

authRouter.post(
  '/google',
  googleLimiter,
  validate({ body: z.object({ credential: z.string({ error: 'Missing Google credential' }).min(1).max(4096) }) }),
  async (req, res) => {
    requireGoogle();
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: env.googleClientId });
      payload = ticket.getPayload();
    } catch {
      throw new HttpError(401, 'Google sign-in failed, try again');
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new HttpError(401, 'Your Google account email is not verified');
    }

    const address = payload.email.toLowerCase();
    const linked = await User.findOne({ googleId: payload.sub });
    if (linked) {
      signIn(res, linked);
      return res.json({ user: linked.toSelf() });
    }
    const existing = await User.findOne({ email: address });
    if (existing) return linkOrAskPassword(res, existing, { sub: payload.sub, email: address, hd: payload.hd });

    const signupToken = signPurposeToken({ sub: payload.sub, email: address, hd: payload.hd }, 'google-signup', '15m');
    res.json({ needsUsername: true, signupToken, suggestion: await suggestUsername(payload.name, address) });
  }
);

authRouter.post(
  '/google/complete',
  googleLimiter,
  validate({ body: z.object({ signupToken: z.string({ error: 'Missing sign-up token' }), username }) }),
  async (req, res) => {
    requireGoogle();
    const token = verifyPurposeToken(req.body.signupToken, 'google-signup');
    if (!token) throw new HttpError(400, 'Google sign-up expired, continue with Google again', 'SIGNUP_EXPIRED');

    // Already created (double submit): sign in. The email registered meanwhile: link as /google would.
    const linked = await User.findOne({ googleId: token.sub });
    if (linked) {
      signIn(res, linked);
      return res.json({ user: linked.toSelf() });
    }
    const existing = await User.findOne({ email: token.email });
    if (existing) return linkOrAskPassword(res, existing, token);

    if (await usernameTaken(req.body.username, { email: token.email })) {
      const error = new HttpError(409, 'That username is taken');
      error.field = 'username';
      throw error;
    }

    const user = await User.create({ username: req.body.username, email: token.email, googleId: token.sub });
    await PendingSignup.deleteOne({ email: token.email });
    signIn(res, user);
    res.status(201).json({ user: user.toSelf() });
  }
);

const linkTokenEmail = (req) => verifyPurposeToken(req.body?.linkToken, 'google-link')?.email ?? 'invalid';

// Links Google to an existing account after its password is confirmed once.
authRouter.post(
  '/google/link',
  limiter({ windowMs: 60 * MINUTE, limit: 10, skipSuccessfulRequests: true, keyGenerator: linkTokenEmail, name: 'google-link-account' }),
  limiter({ windowMs: 15 * MINUTE, limit: 10, skipSuccessfulRequests: true, name: 'google-link-ip' }),
  validate({
    body: z.object({
      linkToken: z.string({ error: 'Missing link token' }).max(4096),
      password: z.string({ error: 'Enter your password' }).min(1, 'Enter your password').max(PASSWORD_MAX),
    }),
  }),
  async (req, res) => {
    requireGoogle();
    const token = verifyPurposeToken(req.body.linkToken, 'google-link');
    const expired = () => new HttpError(400, 'This link request expired, continue with Google again', 'LINK_EXPIRED');
    if (!token) throw expired();
    const user = await User.findOne({ email: token.email });
    if (!user) throw expired();

    if (!(await verifyPassword(req.body.password, user.passwordHash ?? DUMMY_HASH)) || !user.passwordHash) {
      const error = new HttpError(401, 'Incorrect password', 'BAD_CREDENTIALS');
      error.field = 'password';
      throw error;
    }
    if (await User.exists({ googleId: token.sub, _id: { $ne: user._id } })) {
      throw new HttpError(409, 'That Google account is already linked to another Chesscube account');
    }

    user.googleId = token.sub;
    await user.save();
    signIn(res, user);
    res.json({ user: user.toSelf() });
  }
);

// ---- Password reset ----

authRouter.post(
  '/forgot-password',
  limiter({ windowMs: 60 * MINUTE, limit: 5, name: 'forgot' }),
  mailIpLimiter,
  validate({ body: z.object({ email }) }),
  async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    // Whatever happens, the response is the same, so it doesn't reveal whether the account exists.
    if (user && !resetLocked(user.resetGuard)) {
      const existing = await EmailCode.findOne({ userId: user._id, purpose: 'reset', ...notExpired() });
      if ((!existing || cooldownRemaining(existing.lastSentAt) === 0) && !(await reserveEmail(user.email))) {
        const newCode = generateCode();
        const now = new Date();
        await EmailCode.findOneAndUpdate(
          { userId: user._id, purpose: 'reset' },
          { codeHash: hashCode(newCode), attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + CODE_TTL_MS) },
          { upsert: true }
        );
        // Not awaited, so the response time doesn't reveal whether the account exists.
        sendMail({ to: user.email, ...passwordResetEmail({ code: newCode }) }).catch((err) =>
          console.error('Reset email failed:', mailErrorSummary(err))
        );
      }
    }
    res.json({ ok: true });
  }
);

authRouter.post(
  '/reset-password',
  limiter({ windowMs: 15 * MINUTE, limit: 20, name: 'reset' }),
  validate({ body: z.object({ email, code, password }) }),
  async (req, res) => {
    // One message for every failure (no account, no code, too many tries, wrong code), so it reveals nothing.
    const invalid = () =>
      new HttpError(400, 'Incorrect or expired code. If it keeps failing, request a new code later.', 'INVALID_CODE');
    const user = await User.findOne({ email: req.body.email });
    if (!user || resetLocked(user.resetGuard)) throw invalid();
    const record = await EmailCode.findOne({ userId: user._id, purpose: 'reset', ...notExpired() });
    if (!record || record.attempts >= MAX_CODE_ATTEMPTS) throw invalid();
    if (!codeMatches(req.body.code, record.codeHash)) {
      await Promise.all([
        EmailCode.updateOne({ _id: record._id }, { $inc: { attempts: 1 } }),
        recordWrongResetGuess(user._id),
      ]);
      throw invalid();
    }

    user.passwordHash = await hashPassword(req.body.password);
    user.resetGuard = undefined;
    user.tokenVersion += 1; // signs out every other session
    await user.save();
    await record.deleteOne();
    signIn(res, user);
    res.json({ user: user.toSelf() });
  }
);

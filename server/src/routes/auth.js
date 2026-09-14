import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { env } from '../config/env.js';
import { code, email, password, username } from '../lib/schemas.js';
import { HttpError } from '../middleware/errors.js';
import { ipKeyGenerator, limiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { EmailCode } from '../models/EmailCode.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';
import {
  CODE_TTL_MS,
  codeIsFresh,
  codeMatches,
  cooldownRemaining,
  generateCode,
  hashCode,
  MAX_CODE_ATTEMPTS,
} from '../services/codes.js';
import { passwordResetEmail, verificationEmail } from '../services/emailTemplates.js';
import { sendMail } from '../services/mailer.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import { clearSessionCookie, signIn, signPurposeToken, verifyPurposeToken } from '../services/tokens.js';
import { usernameTaken } from '../services/usernames.js';
import { PASSWORD_MAX, usernameIssue, USERNAME_RE } from '../shared/validation.js';

const MINUTE = 60 * 1000;
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
    console.error('Email failed:', err.message);
    throw new HttpError(502, "We couldn't send the email. Try again in a moment.");
  }
}

// bcrypt work for unknown accounts too, so response times don't reveal which usernames exist.
const DUMMY_HASH = await hashPassword('timing-equaliser-Aa1');

// ---- Router ----

export const authRouter = Router();

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user?.toSelf() ?? null });
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res);
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
  limiter({ windowMs: 60 * MINUTE, limit: 10 }),
  validate({ body: z.object({ username, email, password }) }),
  async (req, res) => {
    const { username: name, email: address, password: plain } = req.body;
    const now = new Date();

    if (await User.exists({ email: address })) {
      const error = new HttpError(409, 'An account with this email already exists');
      error.field = 'email';
      throw error;
    }
    if (await usernameTaken(name, { email: address })) {
      const error = new HttpError(409, 'That username is taken');
      error.field = 'username';
      throw error;
    }

    // Expired sign-ups the TTL monitor hasn't removed yet would otherwise trip the unique indexes.
    await PendingSignup.deleteMany({ $or: [{ email: address }, { usernameLower: name.toLowerCase() }], expiresAt: { $lte: now } });

    const existing = await PendingSignup.findOne({ email: address });
    if (existing) {
      const wait = cooldownRemaining(existing.lastSentAt);
      if (wait > 0) throw tooSoon(wait);
      if (existing.sends >= MAX_SENDS) throw new HttpError(429, 'Too many codes sent. Try again later.');
    }

    const newCode = generateCode();
    const fields = {
      username: name,
      usernameLower: name.toLowerCase(),
      email: address,
      passwordHash: await hashPassword(plain),
      codeHash: hashCode(newCode),
      attempts: 0,
      lastSentAt: now,
      expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
    };

    let pending;
    if (existing) {
      existing.set({ ...fields, sends: existing.sends + 1 });
      pending = await existing.save();
    } else {
      pending = await PendingSignup.create(fields);
    }

    try {
      await sendOrFail({ to: address, ...verificationEmail({ username: name, code: newCode }) });
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
  limiter({ windowMs: 15 * MINUTE, limit: 30 }),
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
  limiter({ windowMs: 60 * MINUTE, limit: 5 }),
  validate({ body: z.object({ email }) }),
  async (req, res) => {
    const pending = await PendingSignup.findOne({ email: req.body.email, ...notExpired() });
    if (!pending) throw new HttpError(400, 'Sign-up expired, sign up again', 'SIGNUP_EXPIRED');
    const wait = cooldownRemaining(pending.lastSentAt);
    if (wait > 0) throw tooSoon(wait);
    if (pending.sends >= MAX_SENDS) throw new HttpError(429, 'Too many codes sent. Sign up again later.');

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
      await sendOrFail({ to: updated.email, ...verificationEmail({ username: updated.username, code: newCode }) });
    } catch (err) {
      await PendingSignup.updateOne({ _id: updated._id }, { $set: { lastSentAt: new Date(0) } });
      throw err;
    }
    res.json({ email: updated.email, resendIn: RESEND_SECONDS });
  }
);

// ---- Sign in ----

authRouter.post(
  '/signin',
  limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.login ?? '').trim().toLowerCase()}`,
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
    if (cooldownRemaining(pending.lastSentAt) === 0 && pending.sends < MAX_SENDS) {
      const newCode = generateCode();
      const now = new Date();
      pending.set({ codeHash: hashCode(newCode), attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + PENDING_TTL_MS), sends: pending.sends + 1 });
      await pending.save();
      try {
        await sendMail({ to: pending.email, ...verificationEmail({ username: pending.username, code: newCode }) });
      } catch (err) {
        console.error('Email failed:', err.message);
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

const googleLimiter = limiter({ windowMs: 15 * MINUTE, limit: 20 });

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
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.findOne({ email: address });
      if (user) {
        // Same verified email: link Google to the existing account instead of creating a duplicate.
        user.googleId = payload.sub;
        await user.save();
      }
    }
    if (user) {
      signIn(res, user);
      return res.json({ user: user.toSelf() });
    }

    const signupToken = signPurposeToken({ sub: payload.sub, email: address }, 'google-signup', '15m');
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

    // Already created (double submit) or the email registered meanwhile: link and sign in.
    const existing = (await User.findOne({ googleId: token.sub })) ?? (await User.findOne({ email: token.email }));
    if (existing) {
      if (!existing.googleId) {
        existing.googleId = token.sub;
        await existing.save();
      }
      signIn(res, existing);
      return res.json({ user: existing.toSelf() });
    }

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

// ---- Password reset ----

authRouter.post(
  '/forgot-password',
  limiter({ windowMs: 60 * MINUTE, limit: 5 }),
  validate({ body: z.object({ email }) }),
  async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      const existing = await EmailCode.findOne({ userId: user._id, purpose: 'reset', ...notExpired() });
      if (!existing || cooldownRemaining(existing.lastSentAt) === 0) {
        const newCode = generateCode();
        const now = new Date();
        await EmailCode.findOneAndUpdate(
          { userId: user._id, purpose: 'reset' },
          { codeHash: hashCode(newCode), attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + CODE_TTL_MS) },
          { upsert: true }
        );
        // Not awaited, so the response time doesn't reveal whether the account exists.
        sendMail({ to: user.email, ...passwordResetEmail({ code: newCode }) }).catch((err) =>
          console.error('Reset email failed:', err.message)
        );
      }
    }
    res.json({ ok: true });
  }
);

authRouter.post(
  '/reset-password',
  limiter({ windowMs: 15 * MINUTE, limit: 20 }),
  validate({ body: z.object({ email, code, password }) }),
  async (req, res) => {
    const invalid = () => new HttpError(400, 'Code expired or invalid, request a new one', 'INVALID_CODE');
    const user = await User.findOne({ email: req.body.email });
    if (!user) throw invalid();
    const record = await EmailCode.findOne({ userId: user._id, purpose: 'reset', ...notExpired() });
    if (!record) throw invalid();
    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      throw new HttpError(429, 'Too many attempts, request a new code', 'TOO_MANY_ATTEMPTS');
    }
    if (!codeMatches(req.body.code, record.codeHash)) {
      await EmailCode.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      throw new HttpError(400, 'Incorrect code', 'INVALID_CODE');
    }

    user.passwordHash = await hashPassword(req.body.password);
    user.tokenVersion += 1; // signs out every other session
    await user.save();
    await record.deleteOne();
    signIn(res, user);
    res.json({ user: user.toSelf() });
  }
);

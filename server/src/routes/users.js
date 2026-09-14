import { Router } from 'express';
import { z } from 'zod';
import { code, email, password, username } from '../lib/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { limiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { EmailCode } from '../models/EmailCode.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';
import { deleteAccount } from '../services/accountDeletion.js';
import {
  CODE_TTL_MS,
  codeMatches,
  cooldownRemaining,
  generateCode,
  hashCode,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_MS,
} from '../services/codes.js';
import { emailChangeEmail } from '../services/emailTemplates.js';
import { sendMail } from '../services/mailer.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import { clearSessionCookie, signIn } from '../services/tokens.js';
import { usernameTaken } from '../services/usernames.js';
import { isAvatarId } from '../shared/avatars.js';
import { PASSWORD_MAX } from '../shared/validation.js';

const MINUTE = 60 * 1000;

function fieldError(status, message, field, code) {
  const error = new HttpError(status, message, code);
  error.field = field;
  return error;
}

// Keyed by account rather than IP, so guessing someone's current password is capped per account.
const accountLimiter = () =>
  limiter({ windowMs: 15 * MINUTE, limit: 10, skipSuccessfulRequests: true, keyGenerator: (req) => req.user.id });

export const usersRouter = Router();

usersRouter.patch(
  '/me',
  requireAuth,
  validate({
    body: z.object({
      username: username.optional(),
      avatar: z.string().refine(isAvatarId, 'Choose one of the preset avatars').optional(),
    }),
  }),
  async (req, res) => {
    const { user } = req;
    const { username: name, avatar } = req.body;

    if (name !== undefined && name !== user.username) {
      if (await usernameTaken(name, { email: user.email, exceptUserId: user._id })) {
        throw fieldError(409, 'That username is taken', 'username');
      }
      user.username = name; // usernameLower follows in the pre-validate hook
    }
    if (avatar !== undefined) user.avatar = avatar;

    // A unique-index race on usernameLower becomes a 409 in the error handler.
    await user.save();
    res.json({ user: user.toSelf() });
  }
);

usersRouter.post(
  '/me/password',
  requireAuth,
  accountLimiter(),
  validate({
    body: z.object({
      currentPassword: z.string({ error: 'Enter your current password' }).min(1, 'Enter your current password').max(PASSWORD_MAX),
      newPassword: password,
    }),
  }),
  async (req, res) => {
    const { user } = req;
    if (!user.passwordHash) {
      throw new HttpError(400, 'This account has no password yet. Set one with an emailed code instead.');
    }
    if (!(await verifyPassword(req.body.currentPassword, user.passwordHash))) {
      throw fieldError(400, 'Incorrect password', 'currentPassword', 'BAD_CREDENTIALS');
    }

    user.passwordHash = await hashPassword(req.body.newPassword);
    user.tokenVersion += 1; // signs out every other session
    await user.save();
    signIn(res, user); // this browser stays signed in
    res.json({ user: user.toSelf() });
  }
);

// ---- Email change: the new address must confirm a code before anything changes ----

usersRouter.post(
  '/me/email',
  requireAuth,
  limiter({ windowMs: 60 * MINUTE, limit: 10, keyGenerator: (req) => req.user.id }),
  validate({ body: z.object({ email, password: z.string().max(PASSWORD_MAX).optional() }) }),
  async (req, res) => {
    const { user } = req;
    const newEmail = req.body.email;

    if (newEmail === user.email) throw fieldError(400, "That's already your email", 'email');
    if (user.passwordHash && !(req.body.password && (await verifyPassword(req.body.password, user.passwordHash)))) {
      throw fieldError(400, 'Incorrect password', 'password', 'BAD_CREDENTIALS');
    }
    if (await User.exists({ email: newEmail })) {
      throw fieldError(409, 'An account with this email already exists', 'email');
    }

    const existing = await EmailCode.findOne({ userId: user._id, purpose: 'email', expiresAt: { $gt: new Date() } });
    const wait = cooldownRemaining(existing?.lastSentAt);
    if (wait > 0) {
      throw new HttpError(429, `Please wait ${wait} seconds before requesting another code`, 'COOLDOWN', { retryAfter: wait });
    }

    const newCode = generateCode();
    const now = new Date();
    await EmailCode.findOneAndUpdate(
      { userId: user._id, purpose: 'email' },
      { newEmail, codeHash: hashCode(newCode), attempts: 0, lastSentAt: now, expiresAt: new Date(now.getTime() + CODE_TTL_MS) },
      { upsert: true }
    );

    try {
      await sendMail({ to: newEmail, ...emailChangeEmail({ username: user.username, code: newCode }) });
    } catch (err) {
      console.error('Email failed:', err.message);
      await EmailCode.updateOne({ userId: user._id, purpose: 'email' }, { $set: { lastSentAt: new Date(0) } });
      throw new HttpError(502, "We couldn't send the email. Try again in a moment.");
    }
    res.json({ email: newEmail, resendIn: Math.ceil(RESEND_COOLDOWN_MS / 1000) });
  }
);

usersRouter.post(
  '/me/email/verify',
  requireAuth,
  limiter({ windowMs: 15 * MINUTE, limit: 30, keyGenerator: (req) => req.user.id }),
  validate({ body: z.object({ code }) }),
  async (req, res) => {
    const { user } = req;
    const record = await EmailCode.findOne({ userId: user._id, purpose: 'email', expiresAt: { $gt: new Date() } });
    if (!record) throw new HttpError(400, 'Code expired, request a new one', 'INVALID_CODE');
    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      throw new HttpError(429, 'Too many attempts, request a new code', 'TOO_MANY_ATTEMPTS');
    }
    if (!codeMatches(req.body.code, record.codeHash)) {
      await EmailCode.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      throw new HttpError(400, 'Incorrect code', 'INVALID_CODE');
    }

    if (await User.exists({ email: record.newEmail, _id: { $ne: user._id } })) {
      await record.deleteOne();
      throw new HttpError(409, 'That email was registered by another account in the meantime');
    }

    user.email = record.newEmail;
    await user.save(); // a unique-index race becomes a 409 in the error handler
    await record.deleteOne();
    // An unfinished sign-up for the address could never complete now; free its username.
    await PendingSignup.deleteOne({ email: record.newEmail });
    res.json({ user: user.toSelf() });
  }
);

usersRouter.delete(
  '/me',
  requireAuth,
  accountLimiter(),
  validate({
    body: z.object({
      password: z.string().max(PASSWORD_MAX).optional(),
      confirmUsername: z.string().max(40).optional(),
    }),
  }),
  async (req, res) => {
    const { user } = req;
    if (user.passwordHash) {
      if (!req.body.password || !(await verifyPassword(req.body.password, user.passwordHash))) {
        throw fieldError(400, 'Incorrect password', 'password', 'BAD_CREDENTIALS');
      }
    } else if (req.body.confirmUsername?.trim() !== user.username) {
      throw fieldError(400, 'Type your username exactly as shown', 'confirmUsername');
    }

    await deleteAccount(user._id);
    clearSessionCookie(res);
    res.status(204).end();
  }
);

// Public profile, for guests too. Case-insensitive.
usersRouter.get('/:username', async (req, res) => {
  const name = req.params.username;
  const user = name.length <= 20 ? await User.findOne({ usernameLower: name.toLowerCase() }) : null;
  if (!user) throw new HttpError(404, 'Player not found');
  res.json({ user: user.toPublic() });
});

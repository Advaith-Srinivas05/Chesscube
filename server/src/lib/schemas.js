import { z } from 'zod';
import { CODE_RE, PASSWORD_MAX, PASSWORD_RULES, passwordIssues, usernameIssue } from '../shared/validation.js';

// Zod schemas for fields shared by several routers.

export const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

export const username = z
  .string({ error: 'Username is required' })
  .trim()
  .superRefine((value, ctx) => {
    const issue = usernameIssue(value);
    if (issue) ctx.addIssue({ code: 'custom', message: issue });
  });

export const password = z
  .string({ error: 'Password is required' })
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
  .superRefine((value, ctx) => {
    const failed = passwordIssues(value);
    if (failed.length === 0) return;
    const labels = PASSWORD_RULES.filter((rule) => failed.includes(rule.id)).map((rule) => rule.label.toLowerCase());
    ctx.addIssue({ code: 'custom', message: `Password needs ${labels.join(', ')}` });
  });

export const code = z.string({ error: 'Code is required' }).trim().regex(CODE_RE, 'Enter the 6-digit code');

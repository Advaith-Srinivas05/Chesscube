// Mirrored in client/src/shared/validation.js and server/src/shared/validation.js — keep both copies identical.

// 3–20 characters: letters, digits, _ and -, starting with a letter or digit.
export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/;

export const RESERVED_USERNAMES = [
  'admin', 'administrator', 'mod', 'moderator', 'support', 'help', 'system', 'root',
  'chesscube', 'stockfish', 'computer', 'engine', 'anonymous', 'deleted', 'null', 'undefined',
  'api', 'me', 'settings', 'profile', 'signin', 'signup', 'play', 'puzzles', 'learn',
  'leaderboard', 'socials', 'search',
];

export function usernameIssue(name) {
  if (typeof name !== 'string' || name.length < 3) return 'Username must be at least 3 characters';
  if (name.length > 20) return 'Username must be at most 20 characters';
  if (!USERNAME_RE.test(name)) {
    return 'Use letters, numbers, _ and -, starting with a letter or number';
  }
  const lower = name.toLowerCase();
  if (RESERVED_USERNAMES.includes(lower) || lower.startsWith('guest')) {
    return 'That username is reserved';
  }
  return null;
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'A number', test: (p) => /\d/.test(p) },
];

// bcrypt ignores bytes past 72.
export const PASSWORD_MAX = 72;

export function passwordIssues(p) {
  const value = typeof p === 'string' ? p : '';
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.id);
}

export const CODE_RE = /^\d{6}$/;

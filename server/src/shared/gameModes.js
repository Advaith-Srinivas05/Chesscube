// Mirrored in client/src/shared/gameModes.js and server/src/shared/gameModes.js — keep both copies identical.

export const CATEGORIES = [
  { id: 'bullet', name: 'Bullet' },
  { id: 'blitz', name: 'Blitz' },
  { id: 'rapid', name: 'Rapid' },
  { id: 'classical', name: 'Classical' },
  { id: 'chess960', name: 'Chess960' },
];

export const VARIANTS = [
  { id: 'standard', name: 'Standard' },
  { id: 'chess960', name: 'Chess960' },
];

// Base time and increment in seconds.
export const QUICK_PAIRINGS = [
  { id: '1+0', base: 60, inc: 0 },
  { id: '2+1', base: 120, inc: 1 },
  { id: '3+0', base: 180, inc: 0 },
  { id: '3+2', base: 180, inc: 2 },
  { id: '5+0', base: 300, inc: 0 },
  { id: '5+3', base: 300, inc: 3 },
  { id: '10+0', base: 600, inc: 0 },
  { id: '10+5', base: 600, inc: 5 },
  { id: '15+10', base: 900, inc: 10 },
  { id: '30+0', base: 1800, inc: 0 },
  { id: '30+20', base: 1800, inc: 20 },
];

export const CUSTOM_MINUTES = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 45, 60, 90, 120, 180];
export const CUSTOM_INCREMENTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 45, 60];

// Estimated game length assumes 40 moves: base + 40 * increment.
export function categoryFor({ variant, base, inc }) {
  if (variant === 'chess960') return 'chess960';
  const estimate = base + 40 * inc;
  if (estimate < 180) return 'bullet';
  if (estimate < 480) return 'blitz';
  if (estimate < 1500) return 'rapid';
  return 'classical';
}

export function isValidTimeControl({ base, inc }) {
  return CUSTOM_MINUTES.some((minutes) => minutes * 60 === base) && CUSTOM_INCREMENTS.includes(inc);
}

function formatMinutes(seconds) {
  const whole = Math.floor(seconds / 60);
  const half = seconds % 60 === 30;
  if (!half) return String(seconds / 60);
  return whole === 0 ? '½' : `${whole}½`;
}

export function formatTimeControl({ base, inc }) {
  return `${formatMinutes(base)}+${inc}`;
}

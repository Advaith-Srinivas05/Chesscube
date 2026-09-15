import { CATEGORIES, categoryFor, formatTimeControl, VARIANTS } from '../shared/gameModes.js';

// "5+3 · Rated · Blitz", with the variant instead of the category for Chess960.
export function challengeSummary({ variant, base, inc, rated }) {
  const kind =
    variant === 'standard'
      ? CATEGORIES.find((category) => category.id === categoryFor({ variant, base, inc }))?.name
      : VARIANTS.find((entry) => entry.id === variant)?.name;
  return [formatTimeControl({ base, inc }), rated ? 'Rated' : 'Casual', kind].filter(Boolean).join(' · ');
}

export const secondsLeft = (expiresAt, now = Date.now()) => Math.max(0, Math.ceil((expiresAt - now) / 1000));

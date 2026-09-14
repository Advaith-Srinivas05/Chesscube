import { isValidTimeControl } from '../shared/gameModes.js';

// Engine strength per level. movetime is a cap; on the clock the engine also thinks faster when short of time.
export const COMPUTER_LEVELS = [
  { level: 1, skill: 0, depth: 1, movetime: 50 },
  { level: 2, skill: 2, depth: 2, movetime: 100 },
  { level: 3, skill: 5, depth: 3, movetime: 150 },
  { level: 4, skill: 8, depth: 5, movetime: 250 },
  { level: 5, skill: 11, depth: 8, movetime: 400 },
  { level: 6, skill: 14, depth: 11, movetime: 600 },
  { level: 7, skill: 17, depth: 14, movetime: 1000 },
  { level: 8, skill: 20, depth: 18, movetime: 1500 },
];

export const DEFAULT_COMPUTER_GAME = { level: 3, variant: 'standard', color: 'random', tc: null };

// URLSearchParams turns a literal "+" into a space, so accept both "5+3" and "5 3".
function parseTimeControl(value) {
  const match = String(value ?? '').match(/^(\d+(?:\.5)?)[+ ](\d+)$/);
  if (!match) return null;
  const tc = { base: Math.round(Number(match[1]) * 60), inc: Number(match[2]) };
  return isValidTimeControl(tc) ? tc : null;
}

// { level, variant, color, tc: { base, inc } | null } from /play/computer?level=3&variant=standard&color=random&tc=5+3
export function parseComputerParams(params) {
  const level = Number(params.get('level'));
  const variant = params.get('variant');
  const color = params.get('color');
  return {
    level: COMPUTER_LEVELS.some((entry) => entry.level === level) ? level : DEFAULT_COMPUTER_GAME.level,
    variant: variant === 'chess960' ? 'chess960' : 'standard',
    color: ['white', 'black', 'random'].includes(color) ? color : DEFAULT_COMPUTER_GAME.color,
    tc: params.get('tc') === 'unlimited' ? null : parseTimeControl(params.get('tc')),
  };
}

export function computerGamePath({ level, variant, color, tc }) {
  const params = new URLSearchParams({ level: String(level), variant, color });
  const query = `${params}&tc=${tc ? `${tc.base / 60}+${tc.inc}` : 'unlimited'}`;
  return `/play/computer?${query}`;
}

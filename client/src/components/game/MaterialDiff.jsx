import { useSettings } from '../../context/SettingsContext.jsx';
import { pieceUrl } from '../../data/boardOptions.js';
import styles from './MaterialDiff.module.css';

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER = ['q', 'r', 'b', 'n', 'p'];

// Piece counts per colour from the board part of a FEN.
export function materialFromFen(fen) {
  const counts = { white: { p: 0, n: 0, b: 0, r: 0, q: 0 }, black: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const char of String(fen ?? '').split(' ')[0]) {
    const role = char.toLowerCase();
    if (!(role in VALUES)) continue;
    counts[char === role ? 'black' : 'white'][role] += 1;
  }
  return counts;
}

// The opponent pieces `color` is up by (net captures), and "+N" points when ahead.
export default function MaterialDiff({ fen, color }) {
  const { settings } = useSettings();
  const counts = materialFromFen(fen);
  const opponent = color === 'white' ? 'black' : 'white';

  const captured = ORDER.flatMap((role) => {
    const extra = counts[color][role] - counts[opponent][role];
    return extra > 0 ? Array.from({ length: extra }, () => role) : [];
  });
  const score = ORDER.reduce((sum, role) => sum + VALUES[role] * (counts[color][role] - counts[opponent][role]), 0);

  if (captured.length === 0 && score <= 0) return null;

  const prefix = opponent === 'white' ? 'w' : 'b';
  return (
    <span className={styles.diff} aria-label={score > 0 ? `Up ${score} in material` : undefined}>
      <span className={styles.pieces} aria-hidden="true">
        {captured.map((role, index) => (
          <img
            key={`${role}-${index}`}
            className={captured[index - 1] === role ? styles.stacked : undefined}
            src={pieceUrl(settings.pieceSet, `${prefix}${role.toUpperCase()}`)}
            alt=""
            draggable={false}
          />
        ))}
      </span>
      {score > 0 && <span className={styles.score}>+{score}</span>}
    </span>
  );
}

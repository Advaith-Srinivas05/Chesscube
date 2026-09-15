import styles from './EvalBar.module.css';

// "+1.3", "−0.4", "#5" (White mates), "#−5" (Black mates). Scores are from White's point of view.
export function formatScore(score) {
  if (!score) return '';
  if ('mate' in score) return `#${score.mate < 0 ? '−' : ''}${Math.abs(score.mate)}`;
  const pawns = score.cp / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`;
}

// White's share of the bar, 0–100.
export function whiteShare(score) {
  if (!score) return 50;
  if ('mate' in score) return score.mate > 0 ? 100 : 0;
  const share = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * score.cp)) - 1);
  return Math.min(100, Math.max(0, share));
}

/**
 * Vertical bar beside the board (horizontal above it on small screens).
 * `over` is { winner } or { draw } when the position has no moves.
 */
export default function EvalBar({ score, over, orientation = 'white' }) {
  let share = whiteShare(score);
  let label = formatScore(score);
  if (over?.winner) {
    share = over.winner === 'white' ? 100 : 0;
    label = over.winner === 'white' ? '1–0' : '0–1';
  } else if (over?.draw) {
    share = 50;
    label = '½–½';
  }
  const whiteAhead = share >= 50;

  return (
    <div
      className={`${styles.bar} ${orientation === 'black' ? styles.flipped : ''}`}
      role="img"
      aria-label={label ? `Evaluation ${label}` : 'Evaluation pending'}
    >
      <div className={styles.white} style={{ '--share': `${share}%` }} />
      {label && (
        <span className={`${styles.label} ${whiteAhead ? styles.onWhite : styles.onBlack}`} aria-hidden="true">
          {label}
        </span>
      )}
    </div>
  );
}

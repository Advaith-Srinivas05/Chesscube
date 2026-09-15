import styles from './GameResult.module.css';

const TERMINATIONS = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  insufficient: 'Insufficient material',
  repetition: 'Threefold repetition',
  fiftyMove: 'Fifty-move rule',
  timeout: 'Time out',
  timeoutVsInsufficient: 'Time out, but not enough material to win',
  resign: 'Resignation',
  agreement: 'Draw by agreement',
  abandoned: 'A player left the game',
};

export function resultHeadline(result, termination) {
  if (termination === 'abort' || !result) return 'Game aborted';
  if (result === '1-0') return 'White wins';
  if (result === '0-1') return 'Black wins';
  return 'Draw';
}

// result: '1-0' | '0-1' | '1/2-1/2' | null (aborted). `ratings` is optional [{ name, diff }].
export default function GameResult({ result, termination, ratings, actions }) {
  const headline = resultHeadline(result, termination);
  const reason = termination === 'abort' ? null : TERMINATIONS[termination];
  const score = termination === 'abort' || !result ? null : result === '1/2-1/2' ? '½–½' : result.replace('-', '–');

  return (
    <section className={styles.result} aria-live="polite">
      {score && <span className={styles.score}>{score}</span>}
      <p className={styles.headline}>
        {headline}
        {reason && <span className={styles.reason}> · {reason}</span>}
      </p>
      {ratings?.length > 0 && (
        <ul className={styles.ratings}>
          {ratings.map(({ name, diff }) => (
            <li key={name}>
              {name}{' '}
              <span className={diff >= 0 ? styles.gain : styles.loss}>
                {diff >= 0 ? `+${diff}` : `−${Math.abs(diff)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  );
}

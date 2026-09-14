import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { themeName } from '../../data/puzzleThemes.js';
import { withNext } from '../../hooks/useNextPath.js';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import StreakIcon from './StreakIcon.jsx';
import styles from './PuzzlePanel.module.css';

const colorName = (color) => (color === 'white' ? 'White' : 'Black');
const signed = (diff) => (diff >= 0 ? `+${diff}` : `−${Math.abs(diff)}`);
const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

function statusFor(puzzle, mode) {
  const { outcome, mistake, feedback, started, report } = puzzle;
  if (outcome === 'solved') {
    if (mode === 'daily') return { tone: 'good', title: 'Solved!', text: report?.justSolved ? 'Your streak grows.' : null };
    return mistake
      ? { tone: 'neutral', title: 'Solved, with a mistake', text: 'Only the first try counts for your rating.' }
      : { tone: 'good', title: 'Solved!', text: null };
  }
  if (outcome === 'viewed') return { tone: 'neutral', title: 'Solution shown', text: 'Retry to play it through yourself.' };
  if (feedback === 'bad') return { tone: 'bad', title: "That's not it", text: 'Try another move.' };
  if (feedback === 'good') return { tone: 'good', title: 'Best move!', text: 'Keep going.' };
  if (!started) return { tone: 'neutral', title: 'Get ready', text: 'Your opponent is about to move.' };
  return { tone: 'neutral', title: 'Your turn', text: `Find the best move for ${colorName(puzzle.playerColor)}.` };
}

// Thick diagonal arrow: up-right for a gain, down-right for a loss.
function DiffArrow({ up }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.arrow} aria-hidden="true">
      <path d="M7 4h13v13l-4.5-4.5-7.8 7.8-4-4 7.8-7.8z" transform={up ? undefined : 'rotate(90 12 12)'} />
    </svg>
  );
}

function RatingBlock({ puzzle, mode }) {
  const { user } = useAuth();
  const location = useLocation();
  const { report } = puzzle;

  if (mode === 'guest') {
    return (
      <p className={styles.ratingNote}>
        <Link to={withNext('/signin', location.pathname)} className={styles.link}>
          Sign in
        </Link>{' '}
        to earn a puzzle rating.
      </p>
    );
  }

  if (mode === 'daily') {
    if (!report) return null;
    return (
      <div className={styles.rating}>
        <span className={styles.streakIcon}>
          <StreakIcon />
        </span>
        <span className={styles.ratingLabel}>Streak</span>
        <span className={styles.ratingValue}>{days(report.streak ?? 0)}</span>
        <span className={styles.ratingSub}>Best {days(report.best ?? 0)}</span>
      </div>
    );
  }

  const current = report?.rating ?? user?.ratings?.puzzle;
  return (
    <div className={styles.rating}>
      <span className={styles.ratingLabel}>Puzzle rating</span>
      <span className={styles.ratingValue}>
        {current?.rating ?? '—'}
        {current?.provisional && (
          <span className={styles.provisional} title="Provisional rating: not enough puzzles yet">
            ?<span className="sr-only"> (provisional)</span>
          </span>
        )}
        {report?.pending && <Spinner size={14} label="Saving attempt" />}
        {report?.diff !== undefined && (
          <span className={`${styles.diff} ${report.diff >= 0 ? styles.gain : styles.loss}`}>
            {report.diff !== 0 && <DiffArrow up={report.diff > 0} />}
            {signed(report.diff)}
          </span>
        )}
      </span>
      {report?.error && <span className={styles.error}>{report.error}</span>}
    </div>
  );
}

export default function PuzzlePanel({ puzzle, mode }) {
  const { status, error, outcome, mistake } = puzzle;
  const ended = Boolean(outcome);

  if (status === 'error') {
    return (
      <section className={styles.panel} aria-label="Puzzle">
        <p className={styles.errorTitle}>Couldn't load a puzzle</p>
        <p className={styles.text}>{error}</p>
        <div className={styles.footer}>
          <div className={styles.actions}>
            <Button onClick={puzzle.reload}>Try again</Button>
          </div>
        </div>
      </section>
    );
  }

  const state = status === 'ready' ? statusFor(puzzle, mode) : null;
  const details = puzzle.puzzle;
  const showThemes = ended && details?.themes.length > 0;

  return (
    <section className={styles.panel} aria-label="Puzzle" aria-busy={status === 'loading' || undefined}>
      <RatingBlock puzzle={puzzle} mode={mode} />

      {status === 'loading' ? (
        <p className={styles.loading}>
          <Spinner size={16} label={null} /> Loading puzzle…
        </p>
      ) : (
        <>
          <div className={styles.divider} />
          <div className={styles.header}>
            <span className={`${styles.side} ${puzzle.playerColor === 'white' ? styles.white : styles.black}`} aria-hidden="true" />
            <p className={styles.prompt}>
              {mode === 'daily' ? 'Daily puzzle · ' : ''}
              {colorName(puzzle.playerColor)} to play
            </p>
            {ended && mode !== 'daily' && <span className={styles.puzzleRating}>Rating {details.rating}</span>}
          </div>

          <div className={`${styles.status} ${styles[state.tone]}`} aria-live="polite">
            <p className={styles.statusTitle}>{state.title}</p>
            {state.text && <p className={styles.text}>{state.text}</p>}
            {mode === 'daily' && puzzle.report?.error && <p className={styles.error}>{puzzle.report.error}</p>}
            {mode === 'daily' && puzzle.report?.pending && <Spinner size={14} label="Saving" />}
          </div>

          {showThemes && (
            <div className={styles.themeSection}>
              <h3 className={styles.sectionTitle}>Puzzle themes</h3>
              <ul className={styles.themes}>
                {details.themes.map((theme) => (
                  <li key={theme}>{themeName(theme)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.footer}>
            {ended && mode !== 'daily' && (
              <p className={styles.hint}>
                Press <kbd>N</kbd> for the next puzzle
              </p>
            )}
            <div className={styles.actions}>
              {!ended && (
                <Button
                  variant="secondary"
                  onClick={puzzle.viewSolution}
                  disabled={!puzzle.started}
                  title={mode === 'rated' && !mistake ? 'Counts as a failed attempt' : undefined}
                >
                  View solution
                </Button>
              )}
              {(ended || mistake) && (
                <Button variant="secondary" onClick={puzzle.retry}>
                  Retry
                </Button>
              )}
              {mode === 'daily'
                ? ended && (
                    <Button as={Link} to="/puzzles">
                      More puzzles
                    </Button>
                  )
                : (ended || mistake) && (
                    <Button onClick={puzzle.next} title="Keyboard shortcut: N">
                      Next puzzle
                    </Button>
                  )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

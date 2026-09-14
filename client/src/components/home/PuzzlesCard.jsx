import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { puzzleStart } from '../../lib/chess/puzzle.js';
import { fenOf } from '../../lib/chess/rules.js';
import ChessBoard from '../ChessBoard.jsx';
import CategoryIcon from '../icons/CategoryIcon.jsx';
import StreakIcon from '../puzzles/StreakIcon.jsx';
import Button from '../ui/Button.jsx';
import styles from './HomeCards.module.css';

function DailyPreview() {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/puzzles/daily', { signal: controller.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((err) => err.name !== 'AbortError' && setState({ status: 'error' }));
    return () => controller.abort();
  }, [user.id]);

  const start = useMemo(() => {
    if (state.status !== 'ready') return null;
    try {
      const pos = puzzleStart(state.data.puzzle);
      return { fen: fenOf(pos), orientation: pos.turn };
    } catch {
      return null;
    }
  }, [state]);

  const streak = state.data?.streak ?? user.puzzle?.streak ?? 0;
  const solved = Boolean(state.data?.solved);

  return (
    <div className={styles.daily}>
      <div className={styles.miniBoard}>
        {start ? (
          <ChessBoard id="home-daily" position={start.fen} orientation={start.orientation} showNotation={false} />
        ) : (
          <span className={styles.miniBoardBlank} />
        )}
      </div>
      <div className={styles.dailyInfo}>
        <span className={styles.dailyLabel}>Daily puzzle</span>
        <span className={styles.streak}>
          <StreakIcon size={16} />
          {streak} {streak === 1 ? 'day' : 'days'}
        </span>
        <Button
          as={Link}
          to="/puzzles/daily"
          size="sm"
          variant={solved ? 'secondary' : 'primary'}
          aria-disabled={state.status === 'loading' || undefined}
        >
          {solved ? 'Solved ✓' : 'Solve'}
        </Button>
      </div>
    </div>
  );
}

export default function PuzzlesCard() {
  const { user, status } = useAuth();
  const rating = user?.ratings?.puzzle;

  return (
    <>
      <div className={styles.head}>
        <h2 className={styles.title}>Puzzles</h2>
        {rating && (
          <span className={styles.chip} title="Puzzle rating">
            <CategoryIcon category="puzzle" size={15} />
            <span>
              {rating.rating}
              {rating.provisional && <span className={styles.muted}>?</span>}
            </span>
          </span>
        )}
      </div>

      {user ? (
        <>
          <DailyPreview />
          <Link to="/puzzles" className={styles.textLink}>
            Rated puzzles →
          </Link>
        </>
      ) : (
        <>
          <p className={styles.text}>Positions from real games, each with one winning line. Sign in to track a rating and a daily streak.</p>
          {status === 'ready' && (
            <Button as={Link} to="/puzzles" size="sm" className={styles.bottom}>
              Try a puzzle
            </Button>
          )}
        </>
      )}
    </>
  );
}

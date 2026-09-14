import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { withNext } from '../../hooks/useNextPath.js';
import { api } from '../../lib/api.js';
import { puzzleStart } from '../../lib/chess/puzzle.js';
import { fenOf } from '../../lib/chess/rules.js';
import ChessBoard from '../ChessBoard.jsx';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import StreakIcon from './StreakIcon.jsx';
import styles from './DailyCard.module.css';

const formatDate = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function GuestDaily() {
  const location = useLocation();
  return (
    <section className={styles.card} aria-labelledby="daily-title">
      <div className={styles.head}>
        <h2 id="daily-title" className={styles.title}>
          Daily puzzle
        </h2>
      </div>
      <p className={styles.text}>Sign in to solve the daily puzzle and build a streak.</p>
      <Button as={Link} to={withNext('/signin', location.pathname)} size="sm" className={styles.action}>
        Sign in
      </Button>
    </section>
  );
}

export default function DailyCard() {
  const { user } = useAuth();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    api
      .get('/puzzles/daily', { signal: controller.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((err) => err.name !== 'AbortError' && setState({ status: 'error', error: err.message }));
    return () => controller.abort();
  }, [user?.id]);

  const start = useMemo(() => {
    if (state.status !== 'ready') return null;
    try {
      const pos = puzzleStart(state.data.puzzle);
      return { fen: fenOf(pos), orientation: pos.turn };
    } catch {
      return null;
    }
  }, [state]);

  if (!user) return <GuestDaily />;

  const data = state.data;
  const streak = data?.streak ?? 0;
  const solved = Boolean(data?.solved);

  return (
    <section className={styles.card} aria-labelledby="daily-title">
      <div className={styles.head}>
        <h2 id="daily-title" className={styles.title}>
          Daily puzzle
        </h2>
        {data && <span className={styles.date}>{formatDate(data.date)}</span>}
      </div>

      {state.status === 'loading' && <Spinner size={18} />}
      {state.status === 'error' && <p className={styles.text}>{state.error}</p>}

      {state.status === 'ready' && (
        <div className={styles.body}>
          <div className={styles.board}>
            {start && <ChessBoard id="daily-preview" position={start.fen} orientation={start.orientation} showNotation={false} />}
          </div>
          <div className={styles.info}>
            <p className={styles.streak}>
              <span className={styles.streakIcon}>
                <StreakIcon size={18} />
              </span>
              <span>
                Streak · <strong>{streak}</strong> {streak === 1 ? 'day' : 'days'}
              </span>
            </p>
            <Button
              as={Link}
              to="/puzzles/daily"
              size="sm"
              variant={solved ? 'secondary' : 'primary'}
              className={styles.action}
            >
              {solved ? 'Solved ✓' : 'Solve'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

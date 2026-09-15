import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatTimeControl } from '../shared/gameModes.js';
import Avatar from './Avatar.jsx';
import CategoryIcon from './icons/CategoryIcon.jsx';
import card from './profile/Card.module.css';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import Spinner from './ui/Spinner.jsx';
import styles from './MatchHistory.module.css';

const PAGE_SIZE = 20;
const COMPACT_SIZE = 5;
const PILLS = { win: 'W', loss: 'L', draw: 'D' };
const RESULT_WORDS = { win: 'Won', loss: 'Lost', draw: 'Drew' };
const DAY = 24 * 60 * 60 * 1000;

// "5m ago" for the last week, a date after that.
export function formatPlayedAt(value, now = Date.now()) {
  const date = new Date(value);
  const elapsed = now - date.getTime();
  if (elapsed < 7 * DAY) {
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

function GameRow({ game, compact }) {
  const name = game.opponent.username ?? 'Deleted user';
  const moves = Math.ceil(game.moves / 2);
  const diff = game.ratingDiff;

  return (
    <li className={styles.row}>
      <Link
        to={`/game/${game.id}`}
        className={styles.rowLink}
        aria-label={`${RESULT_WORDS[game.result]} against ${name}, ${formatTimeControl(game.tc)}, ${formatPlayedAt(game.endedAt)}`}
      />
      <span className={`${styles.pill} ${styles[game.result]}`} aria-hidden="true">
        {PILLS[game.result]}
      </span>
      <span className={styles.opponent}>
        <Avatar id={game.opponent.avatar} deleted={!game.opponent.username} size={30} />
        <span className={styles.name}>{name}</span>
        {game.opponent.rating != null && <span className={styles.rating}>{game.opponent.rating}</span>}
      </span>
      {/* Always rendered, so casual games leave this column empty instead of shifting the rest. */}
      <span className={`${styles.diff} ${diff > 0 ? styles.gain : diff < 0 ? styles.drop : styles.muted}`}>
        {diff == null ? '' : diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : '±0'}
      </span>
      {/* One grid cell per detail on wide screens; a wrapping second line on phones. */}
      <span className={styles.meta}>
        <span className={styles.time}>
          <CategoryIcon category={game.category} size={16} />
          {formatTimeControl(game.tc)}
        </span>
        {!compact && (
          <>
            <span className={styles.mode}>
              {game.rated ? 'Rated' : 'Casual'}
              {game.variant === 'chess960' && <span className={styles.tag}>Chess960</span>}
            </span>
            <span className={styles.moves}>
              {moves} move{moves === 1 ? '' : 's'}
            </span>
          </>
        )}
        <time dateTime={game.endedAt} className={`${styles.date} ${styles.muted}`}>
          {formatPlayedAt(game.endedAt)}
        </time>
      </span>
      <Link to={`/learn/analysis/${game.id}`} className={styles.analyse}>
        Analyse
      </Link>
    </li>
  );
}

// Finished games for `username`, newest first, with "Load more".
// `compact` (Home card): the last five games in fewer columns, without the card shell or Load more.
export default function MatchHistory({ username, isOwn = false, compact = false }) {
  const [state, setState] = useState({ status: 'loading', games: [], nextBefore: null, loadingMore: false, error: null });

  const load = useCallback(
    async (before, signal) => {
      const query = new URLSearchParams({ limit: String(compact ? COMPACT_SIZE : PAGE_SIZE), ...(before ? { before } : {}) });
      const data = await api.get(`/users/${encodeURIComponent(username)}/games?${query}`, { signal });
      setState((current) => ({
        status: 'ready',
        games: before ? [...current.games, ...data.games] : data.games,
        nextBefore: data.nextBefore,
        loadingMore: false,
        error: null,
      }));
    },
    [username, compact]
  );

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', games: [], nextBefore: null, loadingMore: false, error: null });
    load(null, controller.signal).catch((err) => {
      if (err.name !== 'AbortError') setState((current) => ({ ...current, status: 'error', error: err.message }));
    });
    return () => controller.abort();
  }, [load]);

  function loadMore() {
    setState((current) => ({ ...current, loadingMore: true }));
    load(state.nextBefore).catch((err) => setState((current) => ({ ...current, loadingMore: false, error: err.message })));
  }

  let body;
  if (compact && state.status === 'loading') {
    // Placeholder rows keep the card's height while loading.
    body = (
      <ul className={`${styles.list} ${styles.compact}`} aria-busy="true" aria-label="Loading games">
        {Array.from({ length: COMPACT_SIZE }, (_, index) => (
          <li key={index} className={`${styles.row} ${styles.skeletonRow}`}>
            <span className={styles.skeleton} />
          </li>
        ))}
      </ul>
    );
  } else if (state.status === 'loading') {
    body = (
      <div className={styles.loading}>
        <Spinner label="Loading games" />
      </div>
    );
  } else if (state.status === 'error') {
    body = <EmptyState title="Couldn't load games" text={state.error} className={compact ? styles.compactEmpty : ''} />;
  } else if (state.games.length === 0) {
    body = (
      <EmptyState
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
            <path d="M8 8.5h8M8 12h8M8 15.5h5" />
          </svg>
        }
        title={compact ? 'Your games will show up here' : 'No games yet'}
        text={compact ? null : isOwn ? 'Your finished games will show up here.' : `${username} hasn't finished any games yet.`}
        className={compact ? styles.compactEmpty : ''}
        action={
          isOwn && (
            <Button as={Link} to="/play" size={compact ? 'sm' : 'md'}>
              Play a game
            </Button>
          )
        }
      />
    );
  } else {
    body = (
      <>
        <ul className={`${styles.list} ${compact ? styles.compact : ''}`}>
          {state.games.map((game) => (
            <GameRow key={game.id} game={game} compact={compact} />
          ))}
        </ul>
        {state.error && <p className={styles.error}>{state.error}</p>}
        {!compact && state.nextBefore && (
          <div className={styles.more}>
            <Button variant="secondary" onClick={loadMore} loading={state.loadingMore}>
              Load more
            </Button>
          </div>
        )}
      </>
    );
  }

  if (compact) return body;

  return (
    <section className={card.card} aria-labelledby="history-title">
      <h2 id="history-title" className={card.title}>
        Match history
      </h2>
      {body}
    </section>
  );
}

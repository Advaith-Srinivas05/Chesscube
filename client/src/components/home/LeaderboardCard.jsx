import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { CATEGORIES } from '../../shared/gameModes.js';
import Avatar from '../Avatar.jsx';
import CategoryIcon from '../icons/CategoryIcon.jsx';
import styles from './LeaderboardCard.module.css';

const TOP = 5;

function Rating({ rating, provisional }) {
  return (
    <span className={styles.rating}>
      {rating}
      {provisional && (
        <span className={styles.muted} title="Provisional rating: not enough games yet">
          ?<span className="sr-only"> (provisional)</span>
        </span>
      )}
    </span>
  );
}

// Top five of one category with category buttons; the footer line always shows, so the card keeps its height.
export default function LeaderboardCard() {
  const { user, status } = useAuth();
  const viewer = status === 'ready' ? (user?.id ?? 'guest') : null;
  const [category, setCategory] = useState('blitz');
  // Fetched categories for the current viewer, so switching back is instant.
  const [boards, setBoards] = useState({ viewer, byCategory: {} });
  const [failed, setFailed] = useState(null);

  const board = boards.viewer === viewer ? boards.byCategory[category] : undefined;
  const categoryName = CATEGORIES.find(({ id }) => id === category).name;

  useEffect(() => {
    if (viewer === null || board) return undefined;
    const controller = new AbortController();
    setFailed(null);
    api
      .get(`/leaderboard/${category}`, { signal: controller.signal })
      .then(({ players, me }) =>
        setBoards((prev) => ({
          viewer,
          byCategory: { ...(prev.viewer === viewer ? prev.byCategory : {}), [category]: { players: players.slice(0, TOP), me } },
        }))
      )
      .catch((err) => err.name !== 'AbortError' && setFailed(category));
    return () => controller.abort();
  }, [viewer, category, board]);

  let body;
  if (failed === category && !board) {
    body = <p className={styles.message}>Couldn't load the leaderboard.</p>;
  } else if (!board) {
    body = (
      <ol className={styles.list} aria-busy="true" aria-label="Loading leaderboard">
        {Array.from({ length: TOP }, (_, index) => (
          <li key={index} className={styles.row}>
            <span className={styles.skeleton} />
          </li>
        ))}
      </ol>
    );
  } else if (board.players.length === 0) {
    body = (
      <div className={styles.message}>
        <p>No rated {categoryName} games yet.</p>
        <Link to="/play" className={styles.link}>
          Be the first →
        </Link>
      </div>
    );
  } else {
    body = (
      <ol className={styles.list}>
        {board.players.map((player) => {
          const own = player.username === user?.username;
          return (
            <li key={player.username} className={`${styles.row} ${own ? styles.own : ''}`}>
              <span className={player.rank <= 3 ? styles.podium : styles.rank}>{player.rank}</span>
              <Link to={`/u/${player.username}`} className={styles.player}>
                <Avatar id={player.avatar} size={28} />
                <span className={styles.name}>{player.username}</span>
              </Link>
              <Rating rating={player.rating} provisional={player.provisional} />
            </li>
          );
        })}
      </ol>
    );
  }

  let footer;
  if (!board) footer = ' ';
  else if (!user) footer = 'Sign in and play rated games to get listed.';
  else if (board.me) {
    footer = (
      <>
        Your rank: <strong>#{board.me.rank.toLocaleString()}</strong> ·{' '}
        <Rating rating={board.me.rating} provisional={user.ratings?.[category]?.provisional} />
      </>
    );
  } else footer = `Play a rated ${categoryName} game to get ranked.`;

  return (
    <>
      <div className={styles.head}>
        <h2 className={styles.title}>Leaderboard</h2>
        {/* The selected category shows its name; the others are icons with a tooltip. */}
        <div className={styles.categories} role="group" aria-label="Category">
          {CATEGORIES.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              className={styles.category}
              aria-pressed={id === category}
              aria-label={name}
              title={name}
              onClick={() => setCategory(id)}
            >
              <CategoryIcon category={id} size={16} />
              <span className={styles.categoryName}>{name}</span>
            </button>
          ))}
        </div>
      </div>
      {body}
      <div className={styles.footer}>
        <p>{footer}</p>
        <Link to={`/leaderboard/${category}`} className={styles.link}>
          Full leaderboard →
        </Link>
      </div>
    </>
  );
}

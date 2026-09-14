import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import CategoryIcon from '../components/icons/CategoryIcon.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Tabs, { TabPanel } from '../components/ui/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { CATEGORIES } from '../shared/gameModes.js';
import styles from './Leaderboard.module.css';

const DEFAULT_CATEGORY = 'blitz';
const SKELETON_ROWS = 8;

const TAB_ITEMS = CATEGORIES.map(({ id, name }) => ({
  value: id,
  label: (
    <span className={styles.tabLabel}>
      <CategoryIcon category={id} size={18} />
      {name}
    </span>
  ),
}));

function Rating({ rating, provisional }) {
  return (
    <>
      {rating}
      {provisional && (
        <span className={styles.provisional} title="Provisional rating: not enough games yet">
          ?<span className="sr-only"> (provisional)</span>
        </span>
      )}
    </>
  );
}

function SkeletonRows() {
  return Array.from({ length: SKELETON_ROWS }, (_, index) => (
    <tr key={index} aria-hidden="true">
      <td className={styles.rank}>
        <span className={`${styles.bone} ${styles.boneRank}`} />
      </td>
      <td>
        <span className={styles.player}>
          <span className={`${styles.bone} ${styles.boneAvatar}`} />
          <span className={`${styles.bone} ${styles.boneName}`} />
        </span>
      </td>
      <td className={styles.number}>
        <span className={`${styles.bone} ${styles.boneNumber}`} />
      </td>
      <td className={`${styles.number} ${styles.games}`}>
        <span className={`${styles.bone} ${styles.boneNumber}`} />
      </td>
    </tr>
  ));
}

function Board({ board, user, categoryName }) {
  const loading = !board;
  const players = board?.players ?? [];
  const me = board?.me;
  const listed = user && players.some((player) => player.username === user.username);

  if (!loading && players.length === 0) {
    return (
      <div className={styles.frame}>
        <EmptyState
          icon={<CategoryIcon category={board.category} />}
          title={`No rated ${categoryName} games yet`}
          text="Players show up here after their first rated game in this category."
          action={
            <Button as={Link} to="/play">
              Play
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={`${styles.frame} ${styles.scroll}`} aria-busy={loading || undefined}>
      <table className={styles.table}>
        <caption className="sr-only">{categoryName} leaderboard</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.rank}>
              Rank
            </th>
            <th scope="col">Player</th>
            <th scope="col" className={styles.number}>
              Rating
            </th>
            <th scope="col" className={`${styles.number} ${styles.games}`}>
              Games
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : (
            players.map((player) => {
              const own = player.username === user?.username;
              return (
                <tr key={player.username} className={own ? styles.own : undefined}>
                  <td className={styles.rank}>
                    <span className={player.rank <= 3 ? styles.podium : styles.rankNumber}>{player.rank}</span>
                  </td>
                  <td>
                    <Link to={`/u/${player.username}`} className={styles.player}>
                      <Avatar id={player.avatar} size={30} />
                      <span className={styles.name}>{player.username}</span>
                      {own && <span className={styles.youTag}>You</span>}
                    </Link>
                  </td>
                  <td className={`${styles.number} ${styles.rating}`}>
                    <Rating rating={player.rating} provisional={player.provisional} />
                  </td>
                  <td className={`${styles.number} ${styles.games}`}>{player.games.toLocaleString()}</td>
                </tr>
              );
            })
          )}
        </tbody>
        {!loading && me && !listed && (
          <tfoot>
            <tr className={styles.own}>
              <td className={styles.rank}>
                <span className={styles.rankNumber}>{me.rank.toLocaleString()}</span>
              </td>
              <td>
                <span className={styles.player}>
                  <Avatar id={user.avatar} size={30} />
                  <span className={styles.name}>{user.username}</span>
                  <span className={styles.youTag}>Your rank</span>
                </span>
              </td>
              <td className={`${styles.number} ${styles.rating}`}>
                <Rating rating={me.rating} provisional={user.ratings?.[board.category]?.provisional} />
              </td>
              <td className={`${styles.number} ${styles.games}`}>
                {(user.ratings?.[board.category]?.games ?? 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function Leaderboard() {
  const { category } = useParams();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const viewer = status === 'ready' ? (user?.id ?? 'guest') : null;
  // Fetched tabs for the current viewer, so switching back renders instantly.
  const [boards, setBoards] = useState({ viewer, byCategory: {} });
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const known = CATEGORIES.find((item) => item.id === category);
  const cached = boards.viewer === viewer ? boards.byCategory : {};
  const board = known ? cached[known.id] : undefined;

  useEffect(() => {
    if (!known || viewer === null || board) return undefined;
    const controller = new AbortController();
    setError(null);
    api
      .get(`/leaderboard/${known.id}`, { signal: controller.signal })
      .then((data) => {
        setBoards((prev) => ({
          viewer,
          byCategory: { ...(prev.viewer === viewer ? prev.byCategory : {}), [known.id]: { ...data, category: known.id } },
        }));
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError({ category: known.id, message: err.message });
      });
    return () => controller.abort();
  }, [known, viewer, board, attempt]);

  if (!known) return <Navigate to={`/leaderboard/${DEFAULT_CATEGORY}`} replace />;

  return (
    <div className="page">
      <h1 className={styles.title}>Leaderboard</h1>
      <Tabs
        id="leaderboard"
        label="Game category"
        items={TAB_ITEMS}
        value={known.id}
        onChange={(value) => navigate(`/leaderboard/${value}`)}
        className={styles.tabs}
      />
      <TabPanel tabsId="leaderboard" value={known.id}>
        {error?.category === known.id && !board ? (
          <div className={styles.frame}>
            <EmptyState
              title="Couldn't load the leaderboard"
              text={error.message}
              action={
                <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : (
          <Board board={board} user={status === 'ready' ? user : null} categoryName={known.name} />
        )}
      </TabPanel>
    </div>
  );
}

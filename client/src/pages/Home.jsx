import { Link } from 'react-router-dom';
import CategoryIcon from '../components/icons/CategoryIcon.jsx';
import AboutCard from '../components/home/AboutCard.jsx';
import LeaderboardCard from '../components/home/LeaderboardCard.jsx';
import PuzzlesCard from '../components/home/PuzzlesCard.jsx';
import StartGameCard from '../components/home/StartGameCard.jsx';
import MatchHistory from '../components/MatchHistory.jsx';
import RandomGame from '../components/RandomGame.jsx';
import Button from '../components/ui/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Home.module.css';

const WELCOME_RATINGS = [
  { id: 'blitz', name: 'Blitz' },
  { id: 'rapid', name: 'Rapid' },
  { id: 'puzzle', name: 'Puzzles' },
];

function RatingsRow({ ratings }) {
  return (
    <Link to="/profile" className={styles.ratings} aria-label="Your ratings, open profile">
      {WELCOME_RATINGS.map(({ id, name }) => {
        const { rating = 0, provisional = true } = ratings?.[id] ?? {};
        return (
          <span key={id} className={styles.rating}>
            <span className={styles.ratingName}>
              <CategoryIcon category={id} size={14} />
              {name}
            </span>
            <span className={styles.ratingValue}>
              {rating}
              {provisional && (
                <span className={styles.provisional} title="Provisional rating: not enough games yet">
                  ?
                </span>
              )}
            </span>
          </span>
        );
      })}
    </Link>
  );
}

export default function Home() {
  const { user, status } = useAuth();

  return (
    <div className={`page ${styles.home}`}>
      <section className={styles.board} aria-label="Live engine game">
        <RandomGame />
      </section>

      <section className={`${styles.card} ${styles.welcome}`} aria-label="Welcome">
        {user ? (
          <>
            <h2 className={styles.cardTitle}>Welcome back, {user.username}</h2>
            <p className={styles.cardText}>Good to see you. Your games, ratings and puzzle streak are saved here.</p>
            <RatingsRow ratings={user.ratings} />
          </>
        ) : (
          <>
            <h2 className={styles.cardTitle}>Welcome to the board</h2>
            <p className={styles.cardText}>
              Play as a guest anytime. Sign in to keep your games, track your ratings and progress, and build a
              daily puzzle streak.
            </p>
            {status === 'ready' && (
              <Link to="/signin" className={styles.cardAction}>
                Sign in
              </Link>
            )}
          </>
        )}
      </section>
      <section className={styles.card} aria-label="Start a game">
        <StartGameCard />
      </section>
      <section className={styles.card} aria-label="Puzzles">
        <PuzzlesCard />
      </section>
      <section className={styles.card} aria-label="About">
        <AboutCard />
      </section>
      <section className={`${styles.card} ${styles.history}`} aria-label="Match history">
        <h2 className={styles.cardTitle}>Match history</h2>
        {/* Holds the height of five games whatever the state (guest, loading, empty). */}
        <div className={styles.historyBody}>
          {user ? (
            <MatchHistory username={user.username} isOwn compact />
          ) : (
            <div className={styles.historyGuest}>
              <p className={styles.cardText}>Sign in to keep your match history, with every finished game ready to replay and analyse.</p>
              {status === 'ready' && (
                <Button as={Link} to="/signin" size="sm">
                  Sign in
                </Button>
              )}
            </div>
          )}
        </div>
        <div className={styles.cardFooter}>
          <p>{user ? 'Your last five games.' : "Guest games aren't saved."}</p>
          {user && (
            <Link to="/profile" className={styles.viewAll}>
              View all →
            </Link>
          )}
        </div>
      </section>
      <section className={`${styles.card} ${styles.leaderboard}`} aria-label="Leaderboard">
        <LeaderboardCard />
      </section>
    </div>
  );
}

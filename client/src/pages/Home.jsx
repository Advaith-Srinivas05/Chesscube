import { Link } from 'react-router-dom';
import RandomGame from '../components/RandomGame.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './Home.module.css';

// Card contents other than the welcome card get filled in as their pages are built.
export default function Home() {
  const { user, status } = useAuth();

  return (
    <div className={`page ${styles.home}`}>
      <section className={styles.board} aria-label="Live engine game">
        <RandomGame />
      </section>

      <div className={styles.cards}>
        <section className={`${styles.card} ${styles.welcome}`} aria-label="Welcome">
          {user ? (
            <>
              <h2 className={styles.cardTitle}>Welcome back, {user.username}</h2>
              <p className={styles.cardText}>Good to see you. Your games, ratings and puzzle streak are saved here.</p>
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
        <section className={styles.card} aria-label="Start a game" />
        <section className={styles.card} aria-label="Puzzles" />
        <section className={styles.card} aria-label="About" />
        <section className={`${styles.card} ${styles.wide}`} aria-label="Match history" />
      </div>
    </div>
  );
}

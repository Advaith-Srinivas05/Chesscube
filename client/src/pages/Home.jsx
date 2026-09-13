import { Link } from 'react-router-dom';
import RandomGame from '../components/RandomGame.jsx';
import styles from './Home.module.css';

// Card contents other than the welcome card get filled in as their pages are built.
export default function Home() {
  return (
    <div className={`page ${styles.home}`}>
      <section className={styles.board} aria-label="Live engine game">
        <RandomGame />
      </section>

      <div className={styles.cards}>
        <section className={`${styles.card} ${styles.welcome}`} aria-label="Welcome">
          <h2 className={styles.cardTitle}>Welcome to the board</h2>
          <p className={styles.cardText}>
            Play as a guest anytime. Create an account to save your games, follow your progress and pick up
            right where you left off on any device.
          </p>
          <Link to="/signin" className={styles.cardAction}>
            Sign in
          </Link>
        </section>
        <section className={styles.card} aria-label="Start a game" />
        <section className={styles.card} aria-label="Puzzles" />
        <section className={styles.card} aria-label="About" />
        <section className={`${styles.card} ${styles.wide}`} aria-label="Match history" />
      </div>
    </div>
  );
}

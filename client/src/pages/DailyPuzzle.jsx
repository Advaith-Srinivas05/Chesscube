import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PuzzleTrainer from '../components/puzzles/PuzzleTrainer.jsx';
import styles from './DailyPuzzle.module.css';

// /puzzles/daily (signed in only): solving extends the streak and never changes the rating.
export default function DailyPuzzle() {
  useEffect(() => {
    document.title = 'Daily puzzle · Chesscube';
    return () => {
      document.title = 'Chesscube';
    };
  }, []);

  return (
    <div className="page">
      <h1 className="sr-only">Daily puzzle</h1>
      <div className={styles.header}>
        <Link to="/puzzles" className={styles.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Puzzles
        </Link>
      </div>
      <PuzzleTrainer mode="daily" />
    </div>
  );
}

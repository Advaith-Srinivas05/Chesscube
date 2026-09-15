import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChessBoard from '../components/ChessBoard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LESSON_GROUPS } from '../data/lessons/index.js';
import { withNext } from '../hooks/useNextPath.js';
import styles from './Learn.module.css';

// A position from the Italian Game, shown on the analysis card.
const PREVIEW_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5';

function Check() {
  return (
    <svg viewBox="0 0 24 24" className={styles.checkIcon} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function LessonCard({ lesson, number, done, showProgress }) {
  return (
    <li>
      <Link to={`/learn/lessons/${lesson.id}`} className={`${styles.lesson} ${done ? styles.lessonDone : ''}`}>
        <span className={styles.number} aria-hidden="true">
          {done ? <Check /> : number}
        </span>
        <span className={styles.lessonBody}>
          <span className={styles.lessonTitle}>{lesson.title}</span>
          <span className={styles.lessonSummary}>{lesson.summary}</span>
          <span className={styles.lessonMeta}>
            {lesson.steps.length} steps
            {showProgress && done && <span className={styles.completed}> · Completed ✓</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function Learn() {
  const { user } = useAuth();
  const location = useLocation();
  const completed = new Set(user?.lessons ?? []);

  useEffect(() => {
    document.title = 'Learn · Chesscube';
    return () => {
      document.title = 'Chesscube';
    };
  }, []);

  return (
    <div className="page">
      <header className={styles.header}>
        <h1 className={styles.title}>Learn</h1>
        <p className={styles.intro}>
          Short interactive lessons, from how the pieces move to the tactics that win games, and an analysis board for
          exploring positions on your own.
        </p>
        {!user && (
          <p className={styles.hint}>
            <Link to={withNext('/signin', location.pathname)} className={styles.link}>
              Sign in
            </Link>{' '}
            to track your progress.
          </p>
        )}
      </header>

      <Link to="/learn/analysis" className={styles.feature}>
        <div className={styles.featureText}>
          <span className={styles.eyebrow}>Tool</span>
          <h2 className={styles.featureTitle}>Analysis board</h2>
          <p className={styles.featureCopy}>
            Set up any position, paste a PGN and explore variations with Stockfish showing the best lines as you go.
          </p>
          <span className={styles.featureAction}>
            Open the board
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
        <div className={styles.featureBoard} aria-hidden="true">
          <ChessBoard id="learn-preview" position={PREVIEW_FEN} showNotation={false} />
        </div>
      </Link>

      {LESSON_GROUPS.map((group) => {
        const done = group.lessons.filter((lesson) => completed.has(lesson.id)).length;
        return (
          <section key={group.id} className={styles.group} aria-labelledby={`group-${group.id}`}>
            <div className={styles.groupHeader}>
              <div>
                <h2 id={`group-${group.id}`} className={styles.groupTitle}>
                  {group.title}
                </h2>
                <p className={styles.groupSummary}>{group.summary}</p>
              </div>
              {user && (
                <div className={styles.progress}>
                  <span className={styles.progressText}>
                    {done} / {group.lessons.length}
                  </span>
                  <span
                    className={styles.progressBar}
                    role="progressbar"
                    aria-label={`${group.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={group.lessons.length}
                    aria-valuenow={done}
                  >
                    <span style={{ width: `${(done / group.lessons.length) * 100}%` }} />
                  </span>
                </div>
              )}
            </div>
            <ol className={styles.lessons}>
              {group.lessons.map((lesson, index) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  number={index + 1}
                  done={completed.has(lesson.id)}
                  showProgress={Boolean(user)}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

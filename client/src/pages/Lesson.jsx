import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import LessonPlayer from '../components/learn/LessonPlayer.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LESSON_GROUPS, lessonById, nextLesson } from '../data/lessons/index.js';
import { withNext } from '../hooks/useNextPath.js';
import styles from './Lesson.module.css';

function SaveNote({ save, onRetry }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <p className={styles.note}>
        <Link to={withNext('/signin', location.pathname)} className={styles.link}>
          Sign in
        </Link>{' '}
        to save your progress.
      </p>
    );
  }
  if (save === 'saving') {
    return (
      <p className={styles.note}>
        <Spinner size={14} label={null} /> Saving your progress…
      </p>
    );
  }
  if (save === 'error') {
    return (
      <p className={`${styles.note} ${styles.error}`}>
        Couldn't save your progress.{' '}
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }
  return save === 'saved' ? <p className={styles.note}>Saved to your progress ✓</p> : null;
}

// /learn/lessons/:lessonId — open to guests; completion is saved for signed-in users.
export default function Lesson() {
  const { lessonId } = useParams();
  const { user, completeLesson } = useAuth();
  const lesson = lessonById(lessonId);
  const group = LESSON_GROUPS.find((entry) => entry.id === lesson?.group);
  const [save, setSave] = useState(null); // null | 'saving' | 'saved' | 'error'
  const completed = Boolean(lesson && user?.lessons?.includes(lesson.id));

  useEffect(() => {
    document.title = lesson ? `${lesson.title} · Chesscube` : 'Chesscube';
    return () => {
      document.title = 'Chesscube';
    };
  }, [lesson]);

  useEffect(() => setSave(null), [lessonId]);

  const saveProgress = useCallback(() => {
    if (!user || !lesson) return;
    setSave('saving');
    completeLesson(lesson.id)
      .then(() => setSave('saved'))
      .catch(() => setSave('error'));
  }, [user, lesson, completeLesson]);

  if (!lesson) {
    return (
      <div className="page">
        <EmptyState
          className={styles.notFound}
          title="Lesson not found"
          text="This lesson doesn't exist."
          action={
            <Button as={Link} to="/learn">
              Back to Learn
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="sr-only">{lesson.title}</h1>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
        <Link to="/learn" className={styles.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Learn
        </Link>
        {group && <span className={styles.group}>{group.title}</span>}
        {completed && <span className={styles.completed}>Completed ✓</span>}
      </nav>
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        next={nextLesson(lesson.id)}
        onComplete={saveProgress}
        completeNote={<SaveNote save={save} onRetry={saveProgress} />}
      />
    </div>
  );
}

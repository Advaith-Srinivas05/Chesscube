import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useLessonStep from '../../hooks/useLessonStep.js';
import InteractiveBoard from '../board/InteractiveBoard.jsx';
import Button from '../ui/Button.jsx';
import styles from './LessonPlayer.module.css';

const colorName = (color) => (color === 'white' ? 'White' : 'Black');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function goalLine(step, lesson) {
  switch (step.goal.type) {
    case 'reach':
      return `${plural(lesson.starsLeft, 'star')} left`;
    case 'captureAll':
      return `${plural(lesson.piecesLeft, 'piece')} left to capture`;
    case 'mate':
      return `${colorName(lesson.player)} to play: checkmate in one`;
    default:
      return `${colorName(lesson.player)} to play`;
  }
}

function statusFor(step, lesson, isLast) {
  if (lesson.done) return { tone: 'good', title: isLast ? 'Lesson complete!' : 'Well done!', text: null };
  if (lesson.feedback === 'bad') return { tone: 'bad', title: 'Not quite', text: lesson.hint };
  if (lesson.feedback === 'good') return { tone: 'good', title: 'Good move!', text: 'Keep going.' };
  return { tone: 'neutral', title: goalLine(step, lesson), text: null };
}

function Progress({ total, current, completed }) {
  return (
    <ol className={styles.progress} aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <li
          key={index}
          className={`${styles.dot} ${index < current || (index === current && completed) ? styles.dotDone : ''} ${
            index === current ? styles.dotCurrent : ''
          }`}
        />
      ))}
    </ol>
  );
}

function LessonStep({ lesson, step, index, next, onNextStep, onFinished, footerNote }) {
  const play = useLessonStep(step);
  const total = lesson.steps.length;
  const isLast = index === total - 1;
  const status = statusFor(step, play, isLast);
  const nextButton = useRef(null);

  useEffect(() => {
    if (!play.done) return;
    if (isLast) onFinished?.();
    nextButton.current?.focus({ preventScroll: true });
  }, [play.done]);

  return (
    <div className={styles.player}>
      <section className={styles.boardColumn} aria-label="Lesson board">
        <InteractiveBoard
          id="lesson-board"
          fen={play.fen}
          orientation={play.player}
          movableColor={play.movableColor}
          turn={play.turn}
          dests={play.dests}
          lastMove={play.lastMove}
          check={play.check}
          highlights={play.highlights}
          onMove={play.move}
          viewOnly={!play.movableColor}
          autoQueen={false}
        />
      </section>

      <section className={styles.panel} aria-label="Lesson">
        <div className={styles.heading}>
          <h2 className={styles.title}>{lesson.title}</h2>
          <span className={styles.count}>
            Step {index + 1} of {total}
          </span>
        </div>
        <Progress total={total} current={index} completed={play.done} />

        <p className={styles.text}>{step.text}</p>

        <div className={`${styles.status} ${styles[status.tone]}`} aria-live="polite">
          <p className={styles.statusTitle}>{status.title}</p>
          {status.text && <p className={styles.statusText}>{status.text}</p>}
        </div>

        <div className={styles.footer}>
          {play.done && isLast && footerNote}
          <div className={styles.actions}>
            {(play.touched || play.done) && (
              <Button variant="secondary" onClick={play.retry}>
                {play.done ? 'Play again' : 'Restart step'}
              </Button>
            )}
            {play.done && !isLast && (
              <Button ref={nextButton} onClick={onNextStep}>
                Next step
              </Button>
            )}
            {play.done && isLast &&
              (next ? (
                <Button as={Link} ref={nextButton} to={`/learn/lessons/${next.id}`}>
                  Next: {next.title}
                </Button>
              ) : (
                <Button as={Link} ref={nextButton} to="/learn">
                  Back to Learn
                </Button>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Plays a lesson step by step. `next` is the following lesson ({ id, title }) or null.
 * onComplete fires once when the last step is done; `completeNote` shows under it (e.g. a sign-in prompt).
 */
export default function LessonPlayer({ lesson, next = null, onComplete, completeNote = null }) {
  const [index, setIndex] = useState(0);
  const reported = useRef(false);

  const finished = () => {
    if (reported.current) return;
    reported.current = true;
    onComplete?.(lesson.id);
  };

  return (
    <LessonStep
      key={index}
      lesson={lesson}
      step={lesson.steps[index]}
      index={index}
      next={next}
      onNextStep={() => setIndex((current) => Math.min(current + 1, lesson.steps.length - 1))}
      onFinished={finished}
      footerNote={completeNote}
    />
  );
}

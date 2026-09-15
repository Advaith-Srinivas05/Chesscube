import { useEffect, useRef } from 'react';
import styles from './MoveList.module.css';

export const NAV = [
  { key: 'first', label: 'First move', path: 'M6 5v14M18 5l-8 7 8 7z' },
  { key: 'prev', label: 'Previous move', path: 'M16 5l-8 7 8 7z' },
  { key: 'next', label: 'Next move', path: 'M8 5l8 7-8 7z' },
  { key: 'last', label: 'Last move', path: 'M18 5v14M6 5l8 7-8 7z' },
];

// Target ply for a navigation action; ply 0 is the starting position.
export function navigatePly(action, viewPly, total) {
  const next = { first: 0, prev: viewPly - 1, next: viewPly + 1, last: total }[action];
  return Math.min(total, Math.max(0, next ?? viewPly));
}

// moves: [{ san }]. viewPly is the number of moves shown on the board.
export default function MoveList({ moves, viewPly, onSelect }) {
  const scrollRef = useRef(null);
  const atLatest = viewPly === moves.length;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (atLatest) {
      element.scrollTop = element.scrollHeight;
      element.scrollLeft = element.scrollWidth;
    } else {
      // Scroll only the list (scrollIntoView would also move the page).
      const current = element.querySelector(`.${styles.current}`);
      if (!current) return;
      const box = element.getBoundingClientRect();
      const item = current.getBoundingClientRect();
      if (item.top < box.top || item.bottom > box.bottom) element.scrollTop += item.top - box.top - box.height / 2;
      if (item.left < box.left || item.right > box.right) element.scrollLeft += item.left - box.left - box.width / 2;
    }
  }, [moves.length, viewPly, atLatest]);

  const rows = [];
  for (let index = 0; index < moves.length; index += 2) rows.push(index);

  const moveButton = (index) =>
    moves[index] && (
      <button
        type="button"
        className={`${styles.move} ${viewPly === index + 1 ? styles.current : ''}`}
        aria-current={viewPly === index + 1 ? 'true' : undefined}
        onClick={() => onSelect(index + 1)}
      >
        {moves[index].san}
      </button>
    );

  return (
    <div className={styles.moveList}>
      <ol ref={scrollRef} className={styles.moves} aria-label="Moves">
        {rows.length === 0 && <li className={styles.empty}>No moves yet</li>}
        {rows.map((index) => (
          <li key={index} className={styles.row}>
            <span className={styles.number}>{index / 2 + 1}.</span>
            {moveButton(index)}
            {moveButton(index + 1)}
          </li>
        ))}
      </ol>
      <div className={styles.nav}>
        {NAV.map(({ key, label, path }) => {
          const target = navigatePly(key, viewPly, moves.length);
          return (
            <button
              key={key}
              type="button"
              className={styles.navButton}
              aria-label={label}
              title={label}
              disabled={target === viewPly}
              onClick={() => onSelect(target)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={path} />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

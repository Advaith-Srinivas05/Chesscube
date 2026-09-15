import { useEffect, useRef } from 'react';
import { NAV } from '../game/MoveList.jsx';
import styles from './MoveTree.module.css';

function Move({ node, showNumber, main, current, onSelect }) {
  const isCurrent = node === current;
  const number = node.color === 'white' ? `${node.moveNumber}.` : showNumber ? `${node.moveNumber}…` : null;
  return (
    <button
      type="button"
      className={`${styles.move} ${main ? styles.main : ''} ${isCurrent ? styles.current : ''}`}
      aria-current={isCurrent ? 'true' : undefined}
      onClick={() => onSelect(node)}
    >
      {number && <span className={styles.number}>{number}</span>}
      {node.san}
    </button>
  );
}

/**
 * The moves after `from`, following first children. Alternatives follow the move they replace:
 * as indented blocks off the main line, and in parentheses deeper down.
 */
function Line({ from, showNumber, depth, current, onSelect }) {
  const items = [];
  let node = from;
  let number = showNumber;
  while (node.children.length) {
    const [next, ...alternatives] = node.children;
    items.push(<Move key={next.id} node={next} showNumber={number} main={depth === 0} current={current} onSelect={onSelect} />);
    number = false;
    for (const alternative of alternatives) {
      const Wrapper = depth === 0 ? 'div' : 'span';
      items.push(
        <Wrapper key={`v${alternative.id}`} className={depth === 0 ? styles.variation : styles.nested}>
          <Move node={alternative} showNumber current={current} onSelect={onSelect} />
          <Line from={alternative} showNumber={false} depth={depth + 1} current={current} onSelect={onSelect} />
        </Wrapper>
      );
      number = true;
    }
    node = next;
  }
  return items;
}

// Move tree with navigation buttons and actions for the variation on the board.
export default function MoveTree({ root, current, version, isStart, isEnd, inVariation, onSelect, onNavigate, onPromote, onRemove }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const element = scrollRef.current;
    const item = element?.querySelector('[aria-current="true"]');
    if (!element) return;
    if (!item) {
      element.scrollTop = 0;
      return;
    }
    // Scroll only the list (scrollIntoView would also move the page).
    const box = element.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    if (rect.top < box.top || rect.bottom > box.bottom) element.scrollTop += rect.top - box.top - box.height / 2;
  }, [current, version]);

  const disabled = { first: isStart, prev: isStart, next: isEnd, last: isEnd };

  return (
    <div className={styles.tree}>
      <div ref={scrollRef} className={styles.moves} aria-label="Moves">
        {root.children.length === 0 ? (
          <p className={styles.empty}>Play a move on the board to start.</p>
        ) : (
          <Line from={root} showNumber depth={0} current={current} onSelect={onSelect} />
        )}
      </div>
      {!isStart && (
        <div className={styles.actions}>
          {inVariation && (
            <button type="button" className={styles.action} onClick={onPromote}>
              Promote variation
            </button>
          )}
          <button type="button" className={`${styles.action} ${styles.danger}`} onClick={onRemove}>
            Delete from here
          </button>
        </div>
      )}
      <div className={styles.nav}>
        {NAV.map(({ key, label, path }) => (
          <button
            key={key}
            type="button"
            className={styles.navButton}
            aria-label={label}
            title={label}
            disabled={disabled[key]}
            onClick={() => onNavigate(key)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={path} />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

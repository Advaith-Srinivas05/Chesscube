import { useEffect, useRef } from 'react';
import { pieceUrl } from '../../data/boardOptions.js';
import styles from './PromotionPicker.module.css';

const CHOICES = [
  { role: 'q', code: 'Q', name: 'Queen' },
  { role: 'n', code: 'N', name: 'Knight' },
  { role: 'r', code: 'R', name: 'Rook' },
  { role: 'b', code: 'B', name: 'Bishop' },
];

// Vertical strip over the promotion square's file. Esc or a click outside the strip cancels.
export default function PromotionPicker({ square, color, orientation, pieceSet, onSelect, onCancel }) {
  const firstRef = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const file = square.charCodeAt(0) - 97;
  const column = orientation === 'white' ? file : 7 - file;
  const fromTop = (square[1] === '8') === (orientation === 'white');

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') cancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.overlay} onClick={onCancel} onContextMenu={(event) => event.preventDefault()}>
      <div
        className={styles.strip}
        role="dialog"
        aria-label="Promote pawn to"
        style={{ left: `${column * 12.5}%`, [fromTop ? 'top' : 'bottom']: 0, flexDirection: fromTop ? 'column' : 'column-reverse' }}
        onClick={(event) => event.stopPropagation()}
      >
        {CHOICES.map(({ role, code, name }, index) => (
          <button
            key={role}
            ref={index === 0 ? firstRef : undefined}
            type="button"
            className={styles.choice}
            aria-label={name}
            onClick={() => onSelect(role)}
          >
            <img src={pieceUrl(pieceSet, `${color === 'white' ? 'w' : 'b'}${code}`)} alt="" draggable={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

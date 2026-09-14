import { useEffect, useState } from 'react';
import styles from './GameControls.module.css';

const ICONS = {
  abort: <path d="M6 6l12 12M18 6L6 18" />,
  draw: <path d="M5 9h14M5 15h14" />,
  resign: <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />,
  flip: <path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3" />,
};

function ControlButton({ icon, label, onClick, disabled }) {
  return (
    <button type="button" className={styles.control} onClick={onClick} disabled={disabled} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ICONS[icon]}
      </svg>
      <span>{label}</span>
    </button>
  );
}

// Abort shows only while the game can still be aborted; hide the draw offer with showDraw={false}.
export default function GameControls({
  canAbort = false,
  onAbort,
  showDraw = true,
  canOfferDraw = false,
  onOfferDraw,
  canResign = false,
  onResign,
  onFlip,
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!canResign) setConfirming(false);
  }, [canResign]);

  if (confirming) {
    return (
      <div className={`${styles.controls} ${styles.confirm}`} role="group" aria-label="Confirm resignation">
        <span className={styles.question}>Resign this game?</span>
        <button
          type="button"
          className={`${styles.pill} ${styles.danger}`}
          onClick={() => {
            setConfirming(false);
            onResign?.();
          }}
        >
          Resign
        </button>
        <button type="button" className={styles.pill} onClick={() => setConfirming(false)} autoFocus>
          Keep playing
        </button>
      </div>
    );
  }

  return (
    <div className={styles.controls}>
      {canAbort ? (
        <ControlButton icon="abort" label="Abort" onClick={onAbort} />
      ) : (
        <ControlButton icon="resign" label="Resign" onClick={() => setConfirming(true)} disabled={!canResign} />
      )}
      {showDraw && <ControlButton icon="draw" label="Offer draw" onClick={onOfferDraw} disabled={!canOfferDraw} />}
      <ControlButton icon="flip" label="Flip board" onClick={onFlip} />
    </div>
  );
}

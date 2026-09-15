import { useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryFor, CATEGORIES, QUICK_PAIRINGS } from '../../shared/gameModes.js';
import ComputerGameDialog from '../play/ComputerGameDialog.jsx';
import styles from './HomeCards.module.css';

// Play starts searching for `?pair=<presetId>` on arrival.
const TILES = ['1+0', '3+2', '10+0'].map((id) => {
  const preset = QUICK_PAIRINGS.find((entry) => entry.id === id);
  return { id, category: CATEGORIES.find((entry) => entry.id === categoryFor(preset)).name };
});

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

function OnlineIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8.5" r="3" />
      <circle cx="16" cy="8.5" r="3" />
      <path d="M2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0" />
    </svg>
  );
}

function ComputerIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
      <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="0.8" />
      <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} {...ICON_PROPS}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function StartGameCard() {
  const [computerOpen, setComputerOpen] = useState(false);

  return (
    <>
      <h2 className={styles.title}>Start a game</h2>
      <div className={styles.tiles}>
        {TILES.map(({ id, category }) => (
          <Link key={id} to={`/play?pair=${encodeURIComponent(id)}`} className={styles.tile} aria-label={`Play ${id} ${category}`}>
            <span className={styles.tileTime}>{id}</span>
            <span className={styles.tileCategory}>{category}</span>
          </Link>
        ))}
      </div>
      <div className={styles.links}>
        <Link to="/play" className={styles.linkRow}>
          <span className={styles.linkIcon}>
            <OnlineIcon />
          </span>
          <span className={styles.linkText}>
            More time controls
            <span className={styles.linkHint}>Lobby or custom</span>
          </span>
          <Arrow />
        </Link>
        <button type="button" className={styles.linkRow} onClick={() => setComputerOpen(true)}>
          <span className={styles.linkIcon}>
            <ComputerIcon />
          </span>
          <span className={styles.linkText}>
            Play the computer
            <span className={styles.linkHint}>Stockfish, 8 levels</span>
          </span>
          <Arrow />
        </button>
      </div>
      <ComputerGameDialog open={computerOpen} onClose={() => setComputerOpen(false)} />
    </>
  );
}

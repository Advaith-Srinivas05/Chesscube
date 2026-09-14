import { useEffect } from 'react';
import usePuzzle from '../../hooks/usePuzzle.js';
import InteractiveBoard from '../board/InteractiveBoard.jsx';
import PuzzlePanel from './PuzzlePanel.jsx';
import styles from './PuzzleTrainer.module.css';

// Board on the left, puzzle panel on the right (below the board on narrow screens). `children` go under the panel.
export default function PuzzleTrainer({ mode, children }) {
  const puzzle = usePuzzle({ mode });
  const { outcome, next } = puzzle;

  // N loads the next puzzle once this one is over.
  useEffect(() => {
    if (!outcome || mode === 'daily') return undefined;
    function handleKeyDown(event) {
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
      next();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [outcome, mode, next]);

  return (
    <div className={styles.trainer}>
      <section className={styles.boardColumn} aria-label="Puzzle board">
        {puzzle.fen ? (
          <InteractiveBoard
            id="puzzle-board"
            fen={puzzle.fen}
            orientation={puzzle.playerColor}
            movableColor={puzzle.movableColor}
            turn={puzzle.turn}
            dests={puzzle.dests}
            lastMove={puzzle.lastMove}
            check={puzzle.check}
            highlights={puzzle.highlights}
            onMove={puzzle.onMove}
            viewOnly={!puzzle.movableColor}
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true" />
        )}
      </section>

      <div className={styles.side}>
        <PuzzlePanel puzzle={puzzle} mode={mode} />
        {children}
      </div>
    </div>
  );
}

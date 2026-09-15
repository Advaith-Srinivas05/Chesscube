import Spinner from '../ui/Spinner.jsx';
import Switch from '../ui/Switch.jsx';
import { formatScore } from './EvalBar.jsx';
import styles from './EngineLines.module.css';

function lineText(moves) {
  return moves
    .map(({ san, moveNumber, color }, index) => {
      if (color === 'white') return `${moveNumber}. ${san}`;
      return index === 0 ? `${moveNumber}… ${san}` : san;
    })
    .join(' ');
}

// Engine switch and the top lines. Clicking a line plays its first move.
export default function EngineLines({ enabled, onToggle, ready, lines, over, maxDepth, onPlay }) {
  const depth = lines[0]?.depth;
  let status;
  if (!enabled) status = 'Off';
  else if (!ready) status = 'Loading…';
  else if (over) status = over.winner ? 'Checkmate' : 'Game over';
  else status = depth ? `Depth ${depth}/${maxDepth}` : 'Thinking…';

  return (
    <section className={styles.engine} aria-label="Engine analysis">
      <Switch checked={enabled} onChange={onToggle} label="Stockfish" description={status} className={styles.switch} />
      {enabled && !over && (
        <ol className={styles.lines}>
          {lines.length === 0 && (
            <li className={styles.waiting}>
              <Spinner size={14} label={null} /> Analysing…
            </li>
          )}
          {lines.map(({ multipv, score, moves }) => (
            <li key={multipv}>
              <button
                type="button"
                className={styles.line}
                disabled={!moves.length}
                onClick={() => onPlay(moves[0].uci)}
                title={moves.length ? `Play ${moves[0].san}` : undefined}
              >
                <span className={`${styles.score} ${(score.mate ?? score.cp) < 0 ? styles.black : ''}`}>
                  {formatScore(score)}
                </span>
                <span className={styles.moves}>{lineText(moves)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

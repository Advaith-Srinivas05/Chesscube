import { useEffect, useState } from 'react';
import Button from '../ui/Button.jsx';
import Field from '../ui/Field.jsx';
import { useToast } from '../ui/Toast.jsx';
import styles from './PositionTools.module.css';

const ICONS = {
  flip: <path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3" />,
  copy: <path d="M9 9h10v10H9zM5 15V5h10" />,
};

function ToolButton({ icon, label, onClick }) {
  return (
    <button type="button" className={styles.tool} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ICONS[icon]}
      </svg>
      <span>{label}</span>
    </button>
  );
}

/**
 * Flip, copy FEN / PGN, and forms to load a FEN or a PGN.
 * onLoadFen(fen) and onLoadPgn(text) throw an Error with a readable message when the input is invalid.
 */
export default function PositionTools({ fen, onFlip, getPgn, onLoadFen, onLoadPgn }) {
  const toast = useToast();
  const [fenDraft, setFenDraft] = useState(fen);
  const [fenError, setFenError] = useState(null);
  const [pgnDraft, setPgnDraft] = useState('');
  const [pgnError, setPgnError] = useState(null);

  useEffect(() => {
    setFenDraft(fen);
    setFenError(null);
  }, [fen]);

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${what} copied`, { tone: 'success' });
    } catch {
      toast.show(`Couldn't copy the ${what}`, { tone: 'danger' });
    }
  }

  function loadFen(event) {
    event.preventDefault();
    try {
      onLoadFen(fenDraft.trim());
    } catch (error) {
      setFenError(error.message);
    }
  }

  function loadPgn(event) {
    event.preventDefault();
    try {
      onLoadPgn(pgnDraft);
      setPgnDraft('');
      setPgnError(null);
    } catch (error) {
      setPgnError(error.message);
    }
  }

  return (
    <section className={styles.tools} aria-label="Position tools">
      <div className={styles.row}>
        <ToolButton icon="flip" label="Flip board" onClick={onFlip} />
        <ToolButton icon="copy" label="Copy FEN" onClick={() => copy(fen, 'FEN')} />
        <ToolButton icon="copy" label="Copy PGN" onClick={() => copy(getPgn(), 'PGN')} />
      </div>

      <details className={styles.import}>
        <summary>Load a position or game</summary>
        <form className={styles.form} onSubmit={loadFen}>
          <Field label="FEN" error={fenError}>
            <input
              value={fenDraft}
              onChange={(event) => {
                setFenDraft(event.target.value);
                setFenError(null);
              }}
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          <Button type="submit" variant="secondary" size="sm" disabled={!fenDraft.trim() || fenDraft.trim() === fen}>
            Load FEN
          </Button>
        </form>
        <form className={styles.form} onSubmit={loadPgn}>
          <Field label="PGN" error={pgnError}>
            <textarea
              value={pgnDraft}
              onChange={(event) => {
                setPgnDraft(event.target.value);
                setPgnError(null);
              }}
              placeholder="Paste a PGN"
              spellCheck={false}
            />
          </Field>
          <Button type="submit" variant="secondary" size="sm" disabled={!pgnDraft.trim()}>
            Load PGN
          </Button>
        </form>
      </details>
    </section>
  );
}

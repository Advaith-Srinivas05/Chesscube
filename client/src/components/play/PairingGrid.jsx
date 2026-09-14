import { categoryFor, CATEGORIES, QUICK_PAIRINGS } from '../../shared/gameModes.js';
import Spinner from '../ui/Spinner.jsx';
import styles from './PairingGrid.module.css';

const categoryName = (preset) => CATEGORIES.find(({ id }) => id === categoryFor(preset))?.name;

// Preset time controls plus a Custom tile. `searchingId` marks the preset being searched for.
export default function PairingGrid({ onSelect, onCustom, searchingId }) {
  return (
    <div className={styles.grid}>
      {QUICK_PAIRINGS.map((preset) => {
        const searching = preset.id === searchingId;
        return (
          <button
            key={preset.id}
            type="button"
            className={`${styles.tile} ${searching ? styles.searching : ''}`}
            aria-busy={searching || undefined}
            onClick={() => onSelect?.(preset)}
          >
            <span className={styles.time}>{preset.id}</span>
            <span className={styles.category}>
              {searching ? (
                <>
                  <Spinner size="0.9em" label={null} />
                  Searching
                </>
              ) : (
                categoryName(preset)
              )}
            </span>
          </button>
        );
      })}
      <button type="button" className={`${styles.tile} ${styles.custom}`} onClick={() => onCustom?.()}>
        <span className={styles.customLabel}>Custom</span>
      </button>
    </div>
  );
}

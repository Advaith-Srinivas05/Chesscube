import { useId } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { categoryFor, CATEGORIES, CUSTOM_INCREMENTS, CUSTOM_MINUTES, VARIANTS } from '../../shared/gameModes.js';
import CategoryIcon from '../icons/CategoryIcon.jsx';
import styles from './GameSettingsFields.module.css';

// Times in seconds, like QUICK_PAIRINGS. color: 'white' | 'random' | 'black'.
export const DEFAULT_GAME_SETTINGS = {
  variant: 'standard',
  base: 300,
  inc: 3,
  rated: false,
  color: 'random',
  unlimited: false,
};

const MODES = [
  { id: false, name: 'Casual' },
  { id: true, name: 'Rated' },
];

const COLORS = [
  { id: 'white', name: 'White' },
  { id: 'random', name: 'Random' },
  { id: 'black', name: 'Black' },
];

function minutesLabel(minutes) {
  const whole = Math.floor(minutes);
  if (minutes === whole) return String(minutes);
  return whole === 0 ? '½' : `${whole}½`;
}

export function Segmented({ label, options, value, onChange, disabled = false, describedBy, compact = false }) {
  return (
    <div
      className={`${styles.segmented} ${compact ? styles.compact : ''}`}
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
    >
      {options.map(({ id, name }) => (
        <button
          key={String(id)}
          type="button"
          role="radio"
          aria-checked={value === id}
          disabled={disabled && id !== value}
          className={`${styles.segment} ${value === id ? styles.selected : ''}`}
          onClick={() => onChange(id)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function ColorIcon({ color }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.colorIcon}>
      <circle cx="12" cy="12" r="9" className={color === 'black' ? styles.dark : styles.light} />
      {color === 'random' && <path d="M12 3a9 9 0 0 0 0 18z" className={styles.dark} />}
      <circle cx="12" cy="12" r="9" className={styles.ring} />
    </svg>
  );
}

// Shared fields for every "new game" dialog. `value` is controlled; onChange receives the whole next value.
export default function GameSettingsFields({ value, onChange, showRated = true, showColor = true, allowUnlimited = false }) {
  const { user } = useAuth();
  const id = useId();
  const set = (changes) => onChange({ ...value, ...changes });

  const minutesIndex = Math.max(0, CUSTOM_MINUTES.indexOf(value.base / 60));
  const incIndex = Math.max(0, CUSTOM_INCREMENTS.indexOf(value.inc));
  const minutes = minutesLabel(CUSTOM_MINUTES[minutesIndex]);
  const timed = !(allowUnlimited && value.unlimited);
  const category = categoryFor(value);
  const chip = timed || value.variant === 'chess960' ? CATEGORIES.find((c) => c.id === category) : null;
  const rated = Boolean(user) && value.rated;

  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <span className={styles.label}>Variant</span>
        <Segmented label="Variant" options={VARIANTS} value={value.variant} onChange={(variant) => set({ variant })} />
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span className={styles.label}>Time control</span>
          <span className={styles.chip} aria-live="polite">
            {chip ? (
              <>
                <CategoryIcon category={chip.id} size={16} />
                {chip.name}
              </>
            ) : (
              'Unlimited'
            )}
          </span>
        </div>

        {allowUnlimited && (
          <label className={styles.toggle}>
            <input type="checkbox" checked={value.unlimited} onChange={(event) => set({ unlimited: event.target.checked })} />
            <span className={styles.switch} aria-hidden="true" />
            Unlimited time
          </label>
        )}

        {timed && (
          <>
            <div className={styles.slider}>
              <label htmlFor={`${id}-minutes`}>
                Minutes per side: <strong>{minutes}</strong>
              </label>
              <input
                id={`${id}-minutes`}
                type="range"
                min={0}
                max={CUSTOM_MINUTES.length - 1}
                step={1}
                value={minutesIndex}
                aria-valuetext={`${minutes} minutes`}
                onChange={(event) => set({ base: CUSTOM_MINUTES[Number(event.target.value)] * 60 })}
              />
            </div>
            <div className={styles.slider}>
              <label htmlFor={`${id}-inc`}>
                Increment in seconds: <strong>{CUSTOM_INCREMENTS[incIndex]}</strong>
              </label>
              <input
                id={`${id}-inc`}
                type="range"
                min={0}
                max={CUSTOM_INCREMENTS.length - 1}
                step={1}
                value={incIndex}
                aria-valuetext={`${CUSTOM_INCREMENTS[incIndex]} seconds`}
                onChange={(event) => set({ inc: CUSTOM_INCREMENTS[Number(event.target.value)] })}
              />
            </div>
          </>
        )}
      </div>

      {showRated && (
        <div className={styles.field}>
          <span className={styles.label}>Mode</span>
          <Segmented
            label="Mode"
            options={MODES}
            value={rated}
            disabled={!user}
            describedBy={user ? undefined : `${id}-rated-hint`}
            onChange={(next) => set({ rated: next })}
          />
          {!user && (
            <p id={`${id}-rated-hint`} className={styles.hint}>
              Sign in to play rated games
            </p>
          )}
        </div>
      )}

      {showColor && (
        <div className={styles.field}>
          <span className={styles.label}>Colour</span>
          <div className={styles.colors} role="radiogroup" aria-label="Colour">
            {COLORS.map(({ id: color, name }) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={value.color === color}
                aria-label={name}
                title={name}
                className={`${styles.color} ${color === 'random' ? styles.random : ''} ${value.color === color ? styles.selected : ''}`}
                onClick={() => set({ color })}
              >
                <ColorIcon color={color} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

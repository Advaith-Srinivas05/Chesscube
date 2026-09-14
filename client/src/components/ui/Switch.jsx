import { useId } from 'react';
import styles from './Switch.module.css';

// On/off toggle. Clicking the label or description toggles it too.
export default function Switch({ checked, onChange, label, description, disabled = false, className = '' }) {
  const id = useId();

  return (
    <div className={`${styles.row} ${disabled ? styles.disabled : ''} ${className}`}>
      <label htmlFor={id} className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && (
          <span id={`${id}-description`} className={styles.description}>
            {description}
          </span>
        )}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-description` : undefined}
        disabled={disabled}
        className={`${styles.switch} ${checked ? styles.on : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} aria-hidden="true" />
      </button>
    </div>
  );
}

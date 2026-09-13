import { Children, cloneElement, isValidElement, useId } from 'react';
import styles from './Field.module.css';

// Wraps a single <input>, <textarea> or <select> and wires up its label, hint and error.
export default function Field({ label, hint, error, adornment, children, className = '' }) {
  const generatedId = useId();
  const control = Children.only(children);
  const id = (isValidElement(control) && control.props.id) || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [control.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''} ${className}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.control} ${adornment ? styles.withAdornment : ''}`}>
        {cloneElement(control, {
          id,
          'aria-describedby': describedBy,
          'aria-invalid': error ? true : control.props['aria-invalid'],
        })}
        {adornment && <div className={styles.adornment}>{adornment}</div>}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

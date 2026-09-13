import styles from './Spinner.module.css';

// Pass label={null} when the spinner is decorative (e.g. inside a button that already says it is busy).
export default function Spinner({ size = 20, label = 'Loading', className = '' }) {
  const spinner = (
    <span
      className={`${styles.spinner} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
  if (label === null) return spinner;
  return (
    <span role="status" className={styles.wrap}>
      {spinner}
      <span className="sr-only">{label}</span>
    </span>
  );
}

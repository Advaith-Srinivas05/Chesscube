import Spinner from './ui/Spinner.jsx';
import styles from '../pages/Auth.module.css';

// Hint text under a username field for useUsernameAvailability's result.
export default function UsernameStatus({ availability }) {
  const { state, message } = availability;
  if (state === 'idle') return message || '3–20 characters: letters, numbers, _ and -';
  if (state === 'checking') {
    return (
      <span className={styles.status}>
        <Spinner size={12} label={null} /> Checking…
      </span>
    );
  }
  return (
    <span className={`${styles.status} ${state === 'available' ? styles.available : styles.taken}`} aria-live="polite">
      {message}
    </span>
  );
}

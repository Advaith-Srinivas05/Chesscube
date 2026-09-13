import styles from './Logo.module.css';

export default function Logo() {
  return (
    <span className={styles.logo}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" className={styles.markBg} />
        <rect x="7" y="7" width="9" height="9" rx="1.5" className={styles.markAccent} />
        <rect x="16" y="16" width="9" height="9" rx="1.5" className={styles.markAccent} />
        <rect x="16" y="7" width="9" height="9" rx="1.5" className={styles.markMuted} />
        <rect x="7" y="16" width="9" height="9" rx="1.5" className={styles.markMuted} />
      </svg>
      <span className={styles.wordmark}>Chess</span>
    </span>
  );
}

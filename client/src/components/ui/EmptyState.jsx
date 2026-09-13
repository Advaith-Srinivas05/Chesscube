import styles from './EmptyState.module.css';

export default function EmptyState({ icon, title, text, action, className = '' }) {
  return (
    <div className={`${styles.empty} ${className}`}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      {title && <h3 className={styles.title}>{title}</h3>}
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

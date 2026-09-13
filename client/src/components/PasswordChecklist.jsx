import { PASSWORD_RULES } from '../shared/validation.js';
import styles from './PasswordChecklist.module.css';

export default function PasswordChecklist({ password, id }) {
  return (
    <ul id={id} className={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={`${styles.rule} ${met ? styles.met : ''}`}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {met ? <path d="M3.5 8.5l3 3 6-7" /> : <circle cx="8" cy="8" r="2.5" />}
            </svg>
            {rule.label}
            <span className="sr-only">{met ? ' (done)' : ' (not yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

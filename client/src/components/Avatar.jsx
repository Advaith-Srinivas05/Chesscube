import { pieceUrl } from '../data/boardOptions.js';
import { AVATARS } from '../shared/avatars.js';
import styles from './Avatar.module.css';

// Preset avatar: a cburnett piece on a coloured circle. `deleted` shows a neutral silhouette.
export default function Avatar({ id, size = 38, alt = '', deleted = false, className = '' }) {
  const style = { width: size, height: size };

  if (deleted) {
    return (
      <span className={`${styles.avatar} ${styles.deleted} ${className}`} style={style} role="img" aria-label="Deleted user">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="9" r="4" />
          <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
        </svg>
      </span>
    );
  }

  const avatar = AVATARS.find((preset) => preset.id === id) ?? AVATARS[0];
  return (
    <span
      className={`${styles.avatar} ${className}`}
      style={{ ...style, background: avatar.bg }}
      {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
    >
      <img src={pieceUrl('cburnett', avatar.piece)} alt="" draggable={false} />
    </span>
  );
}

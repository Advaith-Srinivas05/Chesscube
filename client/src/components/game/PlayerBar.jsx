import { Link } from 'react-router-dom';
import styles from './PlayerBar.module.css';

// One player's strip beside the board. `avatar`, `material` and `clock` are slots.
export default function PlayerBar({
  name,
  username,
  avatar,
  rating,
  provisional = false,
  ratingDiff,
  material,
  clock,
  active = false,
  className = '',
}) {
  return (
    <div className={`${styles.bar} ${active ? styles.active : ''} ${className}`}>
      {avatar && <span className={styles.avatar}>{avatar}</span>}
      <div className={styles.info}>
        <div className={styles.nameRow}>
          {username ? (
            <Link to={`/u/${username}`} className={`${styles.name} ${styles.link}`}>
              {name ?? username}
            </Link>
          ) : (
            <span className={styles.name}>{name}</span>
          )}
          {rating != null && (
            <span className={styles.rating}>
              {rating}
              {provisional && '?'}
            </span>
          )}
          {ratingDiff != null && ratingDiff !== 0 && (
            <span className={ratingDiff > 0 ? styles.gain : styles.loss}>
              {ratingDiff > 0 ? `+${ratingDiff}` : `−${Math.abs(ratingDiff)}`}
            </span>
          )}
        </div>
        <div className={styles.material}>{material}</div>
      </div>
      {clock && <div className={styles.clock}>{clock}</div>}
    </div>
  );
}

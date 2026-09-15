import Avatar from '../Avatar.jsx';
import styles from './PresenceAvatar.module.css';

export function presenceLabel({ online, gameId }) {
  if (gameId) return 'Playing a game';
  return online ? 'Online' : 'Offline';
}

// Avatar with a dot: green while online, accent while in a game, none when offline.
export default function PresenceAvatar({ id, size = 40, online = false, gameId = null }) {
  const state = gameId ? 'playing' : online ? 'online' : null;
  return (
    <span className={styles.wrap}>
      <Avatar id={id} size={size} />
      {state && <span className={`${styles.dot} ${styles[state]}`} aria-hidden="true" />}
    </span>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import useSocketEvent from '../../hooks/useSocketEvent.js';
import ChallengeFriendDialog from '../play/ChallengeFriendDialog.jsx';
import Button from '../ui/Button.jsx';
import styles from './PresenceStatus.module.css';

// "Online · Challenge" or "Playing now · Watch game" under a friend's name. The profile API sends
// online/gameId only to friends; presence:update keeps it live. Renders nothing otherwise.
export default function PresenceStatus({ user }) {
  const [presence, setPresence] = useState({ online: Boolean(user.online), gameId: user.gameId ?? null });
  const [challengeOpen, setChallengeOpen] = useState(false);

  useSocketEvent('presence:update', ({ username, online, gameId }) => {
    if (username.toLowerCase() === user.username.toLowerCase()) setPresence({ online, gameId });
  });

  if (user.relation !== 'friends' || (!presence.online && !presence.gameId)) return null;

  return (
    <div className={styles.status}>
      <span className={`${styles.dot} ${presence.gameId ? styles.playing : styles.online}`} aria-hidden="true" />
      {presence.gameId ? (
        <>
          <span>Playing now</span>
          <Button as={Link} to={`/game/${presence.gameId}`} size="sm" variant="secondary">
            Watch game
          </Button>
        </>
      ) : (
        <>
          <span>Online</span>
          <Button size="sm" variant="secondary" onClick={() => setChallengeOpen(true)}>
            Challenge
          </Button>
        </>
      )}
      <ChallengeFriendDialog open={challengeOpen} onClose={() => setChallengeOpen(false)} initialFriend={user.username} />
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import ChallengeFriendDialog from '../play/ChallengeFriendDialog.jsx';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Menu from '../ui/Menu.jsx';
import PresenceAvatar from './PresenceAvatar.jsx';
import styles from './Social.module.css';

// In a game, then online, then offline; alphabetical within each group.
const presenceRank = (friend) => (friend.gameId ? 0 : friend.online ? 1 : 2);

export const shortDate = (date) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export function RemoveFriendDialog({ username, open, onClose, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Remove friend?"
      footer={
        <div className={styles.confirmActions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            Remove
          </Button>
        </div>
      }
    >
      <p className={styles.confirmText}>
        <strong>{username}</strong> will be removed from your friends. You can send a new request later.
      </p>
    </Dialog>
  );
}

export default function FriendList({ friends, onRemove }) {
  const [removing, setRemoving] = useState(null);
  const [challenging, setChallenging] = useState(null);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const sorted = [...friends].sort((a, b) => presenceRank(a) - presenceRank(b));
  const online = friends.filter((friend) => friend.online).length;

  return (
    <section className={styles.panel} aria-labelledby="friends-title">
      <h2 id="friends-title" className={styles.heading}>
        Friends <span className={styles.count}>{friends.length}</span>
        {online > 0 && <span className={styles.onlineCount}>{online} online</span>}
      </h2>

      {friends.length === 0 ? (
        <EmptyState
          className={styles.empty}
          title="No friends yet"
          text="Search for players by username to send them a friend request."
        />
      ) : (
        <ul className={styles.list}>
          {sorted.map((friend) => {
            const { username, avatar } = friend.user;
            const status = friend.gameId ? 'Playing a game' : friend.online ? 'Online' : `Friends since ${shortDate(friend.since)}`;
            return (
              <li key={username} className={styles.row}>
                <PresenceAvatar id={avatar} size={40} online={friend.online} gameId={friend.gameId} />
                <div className={styles.who}>
                  <Link to={`/u/${username}`} className={styles.name}>
                    {username}
                  </Link>
                  <span className={`${styles.meta} ${friend.online || friend.gameId ? styles.live : ''}`}>{status}</span>
                </div>
                <div className={styles.actions}>
                  {friend.gameId ? (
                    <Button as={Link} to={`/game/${friend.gameId}`} size="sm" variant="secondary">
                      Watch
                    </Button>
                  ) : (
                    friend.online && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setChallenging(username);
                          setChallengeOpen(true);
                        }}
                      >
                        Challenge
                      </Button>
                    )
                  )}
                  <Menu
                    label={`Options for ${username}`}
                    triggerClassName={styles.iconButton}
                    items={[
                      { label: 'View profile', to: `/u/${username}` },
                      { label: 'Remove friend', danger: true, onSelect: () => setRemoving(friend) },
                    ]}
                  >
                    <MoreIcon />
                  </Menu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RemoveFriendDialog
        username={removing?.user.username}
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => onRemove(removing)}
      />
      <ChallengeFriendDialog open={challengeOpen} onClose={() => setChallengeOpen(false)} initialFriend={challenging} />
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../Avatar.jsx';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Menu from '../ui/Menu.jsx';
import styles from './Social.module.css';

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

  return (
    <section className={styles.panel} aria-labelledby="friends-title">
      <h2 id="friends-title" className={styles.heading}>
        Friends <span className={styles.count}>{friends.length}</span>
      </h2>

      {friends.length === 0 ? (
        <EmptyState
          className={styles.empty}
          title="No friends yet"
          text="Search for players by username to send them a friend request."
        />
      ) : (
        <ul className={styles.list}>
          {friends.map((friend) => {
            const { username, avatar } = friend.user;
            return (
              <li key={username} className={styles.row}>
                {/* A presence dot (online / playing) joins the avatar later. */}
                <Avatar id={avatar} size={40} />
                <div className={styles.who}>
                  <Link to={`/u/${username}`} className={styles.name}>
                    {username}
                  </Link>
                  <span className={styles.meta}>Friends since {shortDate(friend.since)}</span>
                </div>
                <div className={styles.actions}>
                  {/* Watch and Challenge buttons go here once online play exists. */}
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
    </section>
  );
}

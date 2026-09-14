import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { friendsApi } from '../../lib/friends.js';
import Avatar from '../Avatar.jsx';
import styles from './FriendsPreview.module.css';

const SLOTS = 5;

function EmptySlots() {
  return (
    <div className={styles.slots} aria-hidden="true">
      {Array.from({ length: SLOTS }, (_, index) => (
        <span key={index} className={styles.slot}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="9" r="3.5" />
            <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
          </svg>
        </span>
      ))}
    </div>
  );
}

// Friends at a glance on a profile: the most recent few avatars, the count and (on your own) a link to Socials.
export default function FriendsPreview({ username, isOwn = false }) {
  const [preview, setPreview] = useState({ username: null, count: 0, friends: [] });

  useEffect(() => {
    const controller = new AbortController();
    friendsApi
      .preview(username, { signal: controller.signal })
      .then((data) => setPreview({ username, ...data }))
      .catch((err) => {
        if (err.name !== 'AbortError') setPreview({ username, count: 0, friends: [], failed: true });
      });
    return () => controller.abort();
  }, [username]);

  const loaded = preview.username === username;
  const { count, friends } = loaded ? preview : { count: 0, friends: [] };

  let text;
  if (!loaded) text = null;
  else if (preview.failed) text = "Couldn't load friends.";
  else if (count === 0) text = isOwn ? 'No friends yet. Friends you add will show up here.' : `${username} hasn't added any friends yet.`;
  else text = `${count} ${count === 1 ? 'friend' : 'friends'}`;

  return (
    <section className={styles.preview} aria-labelledby="friends-preview-title">
      <h3 id="friends-preview-title" className={styles.title}>
        Friends
      </h3>
      <div className={styles.body}>
        {count > 0 ? (
          <ul className={styles.slots}>
            {friends.map((friend) => (
              <li key={friend.username} className={styles.friend}>
                <Link to={`/u/${friend.username}`} title={friend.username} className={styles.friendLink}>
                  <Avatar id={friend.avatar} size={38} alt={friend.username} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptySlots />
        )}
        <p className={styles.text} aria-busy={!loaded || undefined}>
          {text}
          {isOwn && loaded && (
            <>
              {' '}
              <Link to="/socials" className={styles.link}>
                {count > 0 ? 'Manage friends' : 'Find friends'}
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}

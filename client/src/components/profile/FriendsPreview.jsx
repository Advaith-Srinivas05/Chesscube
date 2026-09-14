import styles from './FriendsPreview.module.css';

const SLOTS = 5;

// Friends at a glance on a profile. Placeholder until the friend system exists (plan phase 8):
// it will then take a `friends` list and show their avatars, the count and a link to Socials.
export default function FriendsPreview({ username, isOwn = false }) {
  return (
    <section className={styles.preview} aria-labelledby="friends-preview-title">
      <h3 id="friends-preview-title" className={styles.title}>
        Friends
      </h3>
      <div className={styles.body}>
        <div className={styles.slots} aria-hidden="true">
          {Array.from({ length: SLOTS }, (_, index) => (
            <span key={index} className={styles.slot} />
          ))}
        </div>
        <p className={styles.text}>
          {isOwn ? 'No friends yet. Friends you add will show up here.' : `${username} hasn't added any friends yet.`}
        </p>
      </div>
    </section>
  );
}

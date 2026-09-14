import { Link, useLocation } from 'react-router-dom';
import AddFriend from '../components/social/AddFriend.jsx';
import FriendList from '../components/social/FriendList.jsx';
import FriendRequests from '../components/social/FriendRequests.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFriends } from '../hooks/useFriends.js';
import { withNext } from '../hooks/useNextPath.js';
import styles from './Socials.module.css';

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9.5" r="2.8" />
      <path d="M16.5 14.6A5.5 5.5 0 0 1 21.5 20" />
    </svg>
  );
}

function GuestCard() {
  const location = useLocation();
  return (
    <section className={styles.guest}>
      <EmptyState
        icon={<PeopleIcon />}
        title="Friends need an account"
        text="Sign in to add friends, watch their games and send them challenges. Everything else on Chesscube works without one."
        action={
          <div className={styles.guestActions}>
            <Button as={Link} to={withNext('/signin', location.pathname)}>
              Sign in
            </Button>
            <Button as={Link} to={withNext('/signup', location.pathname)} variant="secondary">
              Create account
            </Button>
          </div>
        }
      />
    </section>
  );
}

function SignedIn() {
  const friends = useFriends();
  const { lists, error } = friends;

  if (!lists) {
    return error ? (
      <section className={styles.guest}>
        <EmptyState
          title="Couldn't load your friends"
          text={error}
          action={
            <Button variant="secondary" onClick={friends.retry}>
              Try again
            </Button>
          }
        />
      </section>
    ) : (
      <div className={styles.grid} aria-busy="true">
        <span className="sr-only" role="status">
          Loading friends
        </span>
        <div className={`${styles.skeleton} ${styles.tall}`} />
        <div className={styles.side}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      <FriendList friends={lists.friends} onRemove={friends.unfriend} />
      <div className={styles.side}>
        <AddFriend
          relationOf={friends.relationOf}
          onAdd={friends.sendRequest}
          onAccept={friends.accept}
          isBusy={friends.isBusy}
        />
        <FriendRequests
          incoming={lists.incoming}
          outgoing={lists.outgoing}
          onAccept={friends.accept}
          onDecline={friends.decline}
          onCancel={friends.cancel}
          isBusy={friends.isBusy}
        />
      </div>
    </div>
  );
}

export default function Socials() {
  const { user, status } = useAuth();

  return (
    <div className="page">
      <h1 className={styles.title}>Socials</h1>
      {status === 'loading' ? null : user ? <SignedIn key={user.id} /> : <GuestCard />}
    </div>
  );
}

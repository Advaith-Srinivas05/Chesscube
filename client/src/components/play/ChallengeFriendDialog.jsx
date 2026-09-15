import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { withNext } from '../../hooks/useNextPath.js';
import useSocket from '../../hooks/useSocket.js';
import useSocketEvent from '../../hooks/useSocketEvent.js';
import { challengeSummary, secondsLeft } from '../../lib/challenges.js';
import { friendsApi } from '../../lib/friends.js';
import { request } from '../../lib/socket.js';
import PresenceAvatar, { presenceLabel } from '../social/PresenceAvatar.jsx';
import Button from '../ui/Button.jsx';
import Dialog from '../ui/Dialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Spinner from '../ui/Spinner.jsx';
import { useToast } from '../ui/Toast.jsx';
import GameSettingsFields, { DEFAULT_GAME_SETTINGS } from './GameSettingsFields.jsx';
import styles from './PlayDialogs.module.css';

const friendIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="8.5" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 13 0M18.5 8v6M15.5 11h6" />
  </svg>
);

const available = (friend) => friend.online && !friend.gameId;
const sameName = (a, b) => a?.toLowerCase() === b?.toLowerCase();

function FriendPicker({ friends, selected, onSelect }) {
  const sorted = [...friends].sort((a, b) => available(b) - available(a) || Boolean(b.online) - Boolean(a.online));
  return (
    <div className={styles.friends} role="radiogroup" aria-label="Friend">
      {sorted.map((friend) => {
        const { username, avatar } = friend.user;
        const disabled = !available(friend);
        const checked = sameName(selected, username);
        return (
          <button
            key={username}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            className={`${styles.friend} ${checked ? styles.friendSelected : ''}`}
            onClick={() => onSelect(username)}
          >
            <PresenceAvatar id={avatar} size={34} online={friend.online} gameId={friend.gameId} />
            <span className={styles.friendName}>{username}</span>
            <span className={styles.friendStatus}>{presenceLabel(friend)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Waiting({ challenge, onCancel }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.waiting} role="status">
      <PresenceAvatar id={challenge.to.avatar} size={56} online />
      <p className={styles.waitingTitle}>
        <Spinner size={16} label={null} /> Waiting for {challenge.to.username}…
      </p>
      <p className={styles.hint}>
        {challengeSummary(challenge.settings)} · {secondsLeft(challenge.expiresAt, now)} s left
      </p>
      <Button variant="secondary" onClick={onCancel}>
        Cancel challenge
      </Button>
    </div>
  );
}

function SignedInDialog({ open, onClose, initialFriend }) {
  const toast = useToast();
  const { connected } = useSocket();
  const [friends, setFriends] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_GAME_SETTINGS);
  const [sending, setSending] = useState(false);
  const [challenge, setChallenge] = useState(null); // { id, expiresAt, settings, to }

  useEffect(() => {
    if (!open) return undefined;
    setSettings(DEFAULT_GAME_SETTINGS);
    setChallenge(null);
    setSelected(initialFriend ?? null);
    setFriends(null);
    setLoadError(null);
    const controller = new AbortController();
    friendsApi
      .list({ signal: controller.signal })
      .then((data) => setFriends(data.friends))
      .catch((err) => err.name !== 'AbortError' && setLoadError(err.message));
    return () => controller.abort();
    // Reset only when the dialog opens.
  }, [open]);

  useSocketEvent('presence:update', ({ username, online, gameId }) =>
    setFriends((current) => current?.map((entry) => (sameName(entry.user.username, username) ? { ...entry, online, gameId } : entry)))
  );

  // The answer: accepted closes (LiveSocial opens the game); anything else returns to the form (LiveSocial shows the toast).
  useSocketEvent('challenge:closed', ({ id, reason }) => {
    if (id !== challenge?.id) return;
    setChallenge(null);
    if (reason === 'accepted') onClose();
  });

  const target = friends?.find((friend) => sameName(friend.user.username, selected));
  const canSend = Boolean(target && available(target)) && connected && !sending;

  async function send() {
    setSending(true);
    const response = await request('challenge:create', { username: target.user.username, settings });
    setSending(false);
    if (!response.ok) {
      toast.show(response.message, { tone: 'danger' });
      return;
    }
    setChallenge({ id: response.id, expiresAt: Date.now() + response.expiresIn, settings, to: target.user });
  }

  function cancel() {
    if (challenge) request('challenge:cancel', { id: challenge.id });
    setChallenge(null);
  }

  function close() {
    cancel();
    onClose();
  }

  let body;
  if (challenge) {
    body = <Waiting challenge={challenge} onCancel={cancel} />;
  } else if (loadError) {
    body = <EmptyState title="Couldn't load your friends" text={loadError} />;
  } else if (!friends) {
    body = (
      <div className={styles.loading}>
        <Spinner label="Loading friends" />
      </div>
    );
  } else if (friends.length === 0) {
    body = (
      <section className={styles.picker} aria-label="Friend">
        <EmptyState
          icon={friendIcon}
          title="No friends to challenge yet"
          text="Add friends in Socials to challenge them."
          action={
            <Button as={Link} to="/socials" variant="secondary" size="sm" onClick={onClose}>
              Go to Socials
            </Button>
          }
        />
      </section>
    );
  } else {
    body = (
      <div className={styles.stack}>
        <div className={styles.field}>
          <span className={styles.label}>Friend</span>
          <FriendPicker friends={friends} selected={selected} onSelect={setSelected} />
          {!friends.some(available) && <p className={styles.hint}>None of your friends can play right now.</p>}
        </div>
        <GameSettingsFields value={settings} onChange={setSettings} />
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Challenge a friend"
      footer={
        !challenge && (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {friends?.length > 0 && (
              <Button onClick={send} disabled={!canSend} loading={sending}>
                Send challenge
              </Button>
            )}
          </>
        )
      }
    >
      {body}
    </Dialog>
  );
}

// Pick an online friend and game settings; the friend has 60 s to accept. `initialFriend` preselects a username.
export default function ChallengeFriendDialog({ open, onClose, initialFriend }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Dialog open={open} onClose={onClose} title="Challenge a friend">
        <EmptyState
          icon={friendIcon}
          title="Sign in to challenge friends"
          text="Friends and challenges need an account. Signing up is free and only takes a minute."
          action={
            <Button as={Link} to={withNext('/signin', '/play')}>
              Sign in
            </Button>
          }
        />
      </Dialog>
    );
  }

  return <SignedInDialog open={open} onClose={onClose} initialFriend={initialFriend} />;
}

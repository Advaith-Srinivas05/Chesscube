import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useSocketEvent from '../hooks/useSocketEvent.js';
import { challengeSummary, secondsLeft } from '../lib/challenges.js';
import { request, retainSocket } from '../lib/socket.js';
import Avatar from './Avatar.jsx';
import Button from './ui/Button.jsx';
import { useToast } from './ui/Toast.jsx';
import styles from './LiveSocial.module.css';

const SENDER_MESSAGES = {
  declined: (name) => `${name} declined your challenge`,
  expired: (name) => `${name} didn't answer your challenge`,
  unavailable: (name) => `Your challenge to ${name} ended`,
};

function ChallengeCard({ challenge, onAnswer }) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  async function answer(accept) {
    setBusy(true);
    await onAnswer(challenge, accept);
    setBusy(false);
  }

  const seconds = secondsLeft(challenge.expiresAt, now);
  const total = Math.max(1, Math.round((challenge.expiresAt - challenge.receivedAt) / 1000));

  return (
    <section className={styles.card} role="alertdialog" aria-labelledby={`challenge-${challenge.id}`}>
      <div className={styles.head}>
        <Avatar id={challenge.from.avatar} size={40} />
        <div className={styles.text}>
          <p id={`challenge-${challenge.id}`} className={styles.title}>
            <strong>{challenge.from.username}</strong> challenges you
          </p>
          <p className={styles.summary}>{challengeSummary(challenge.settings)}</p>
        </div>
        <span className={styles.seconds} aria-label={`${seconds} seconds left`}>
          {seconds}s
        </span>
      </div>
      <div className={styles.bar} aria-hidden="true">
        <span style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }} />
      </div>
      <div className={styles.actions}>
        <Button size="sm" onClick={() => answer(true)} loading={busy}>
          Accept
        </Button>
        <Button size="sm" variant="secondary" onClick={() => answer(false)} disabled={busy}>
          Decline
        </Button>
      </div>
    </section>
  );
}

/**
 * App-wide live features for signed-in users: keeps the game server connection open (presence),
 * refreshes the friend request badge, shows incoming challenges and follows accepted ones into the game.
 */
function SignedInLive({ username }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState([]);

  useEffect(() => retainSocket({ background: true }), []);

  useSocketEvent('friends:request', ({ direction }) => direction === 'incoming' && refresh());
  useSocketEvent('friends:accepted', () => refresh());
  useSocketEvent('friends:removed', () => refresh());

  useSocketEvent('challenge:incoming', (challenge) =>
    setIncoming((current) => [...current.filter((entry) => entry.id !== challenge.id), { ...challenge, receivedAt: Date.now(), expiresAt: Date.now() + challenge.expiresIn }])
  );

  useSocketEvent('challenge:closed', ({ id, reason, from, to, gameId }) => {
    setIncoming((current) => current.filter((entry) => entry.id !== id));
    if (reason === 'accepted') {
      // The Play page may already have followed game:start there.
      if (window.location.pathname !== `/game/${gameId}`) navigate(`/game/${gameId}`);
      return;
    }
    const sent = from.username === username;
    if (sent) {
      if (SENDER_MESSAGES[reason]) toast.show(SENDER_MESSAGES[reason](to.username));
    } else if (reason === 'cancelled') {
      toast.show(`${from.username} cancelled the challenge`);
    }
  });

  async function answer(challenge, accept) {
    const response = await request(accept ? 'challenge:accept' : 'challenge:decline', { id: challenge.id });
    if (!response.ok) {
      toast.show(response.message, { tone: 'danger' });
      setIncoming((current) => current.filter((entry) => entry.id !== challenge.id));
    }
  }

  if (incoming.length === 0) return null;
  return (
    <div className={styles.stack} aria-live="polite">
      {incoming.map((challenge) => (
        <ChallengeCard key={challenge.id} challenge={challenge} onAnswer={answer} />
      ))}
    </div>
  );
}

export default function LiveSocial() {
  const { user } = useAuth();
  return user ? <SignedInLive key={user.id} username={user.username} /> : null;
}

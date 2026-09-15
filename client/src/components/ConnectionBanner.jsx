import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketState } from '../hooks/useSocket.js';
import Spinner from './ui/Spinner.jsx';
import styles from './ConnectionBanner.module.css';

// The free API host sleeps when idle and takes up to a minute to wake, so slow starts get a note.
const SLOW_CONNECT_MS = 2000;

// True once `active` has stayed true for SLOW_CONNECT_MS since `since`.
function useSlow(active, since) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return undefined;
    }
    const wait = SLOW_CONNECT_MS - (Date.now() - since);
    if (wait <= 0) {
      setSlow(true);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), wait);
    return () => clearTimeout(timer);
  }, [active, since]);
  return slow;
}

const pageLoadedAt = Date.now();

// Shown while the first account check is slow (any page), or while a page that needs the game server connects.
export default function ConnectionBanner() {
  const { status: authStatus } = useAuth();
  const { pageConsumers, status, connectingSince } = useSocketState();
  const slowAuth = useSlow(authStatus === 'loading', pageLoadedAt);
  const slowSocket = useSlow(status === 'connecting' && Boolean(connectingSince), connectingSince);

  let message = null;
  if (slowAuth) message = 'Waking up the server, this can take up to a minute…';
  else if (pageConsumers > 0 && status === 'reconnecting') message = 'Reconnecting…';
  else if (pageConsumers > 0 && slowSocket) message = 'Connecting to the server…';
  if (!message) return null;

  return (
    <div className={styles.banner} role="status">
      <Spinner size={14} label={null} />
      {message}
    </div>
  );
}

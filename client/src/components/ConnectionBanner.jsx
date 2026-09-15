import { useEffect, useState } from 'react';
import { useSocketState } from '../hooks/useSocket.js';
import Spinner from './ui/Spinner.jsx';
import styles from './ConnectionBanner.module.css';

// The free API host can take a few seconds to wake up, so a slow first connect gets a note.
const SLOW_CONNECT_MS = 2000;

// Shown only while a page that needs the game server is open.
export default function ConnectionBanner() {
  const { consumers, status, connectingSince } = useSocketState();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== 'connecting' || !connectingSince) {
      setSlow(false);
      return undefined;
    }
    const wait = SLOW_CONNECT_MS - (Date.now() - connectingSince);
    if (wait <= 0) {
      setSlow(true);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), wait);
    return () => clearTimeout(timer);
  }, [status, connectingSince]);

  const message = status === 'reconnecting' ? 'Reconnecting…' : status === 'connecting' && slow ? 'Connecting to the server…' : null;
  if (consumers === 0 || !message) return null;

  return (
    <div className={styles.banner} role="status">
      <Spinner size={14} label={null} />
      {message}
    </div>
  );
}

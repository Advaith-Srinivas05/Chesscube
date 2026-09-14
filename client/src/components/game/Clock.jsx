import { useEffect, useRef, useState } from 'react';
import styles from './Clock.module.css';

const LOW_TIME = 10_000;

export function formatClock(ms) {
  const safe = Math.max(0, ms);
  if (safe < 20_000) {
    const tenths = Math.floor(safe / 100);
    return `${Math.floor(tenths / 10)}.${tenths % 10}`;
  }
  const total = Math.floor(safe / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

// Shows `ms` as of `syncedAt` (a performance.now() value), counting down while running.
// onLowTime fires once each time the clock drops under ten seconds while running.
export default function Clock({ ms, running = false, syncedAt, onLowTime, className = '' }) {
  const [now, setNow] = useState(() => performance.now());
  const warnedRef = useRef(ms < LOW_TIME);

  useEffect(() => {
    if (!running) return undefined;
    setNow(performance.now());
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(timer);
  }, [running, syncedAt]);

  const shown = running && syncedAt != null ? Math.max(0, ms - (now - syncedAt)) : Math.max(0, ms);
  const low = shown < LOW_TIME;

  useEffect(() => {
    if (!low) warnedRef.current = false;
    else if (running && !warnedRef.current) {
      warnedRef.current = true;
      onLowTime?.();
    }
  }, [low, running, onLowTime]);

  return (
    <div
      className={`${styles.clock} ${running ? styles.running : ''} ${low ? styles.low : ''} ${className}`}
      role="timer"
      aria-live="off"
    >
      {formatClock(shown)}
    </div>
  );
}

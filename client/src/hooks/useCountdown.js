import { useEffect, useState } from 'react';

// Seconds remaining, ticking down to 0. restart(seconds) starts it again.
export function useCountdown(initialSeconds) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + initialSeconds * 1000);
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  return [remaining, (seconds) => setEndsAt(Date.now() + seconds * 1000)];
}

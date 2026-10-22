import { useEffect, useState } from 'react';

/**
 * Milliseconds left until `endsAt` (a local Date.now()-style timestamp),
 * re-rendered about four times a second. Returns 0 once it has passed and
 * `null` when there is no deadline.
 */
export default function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return undefined;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0); // catch up straight away for a new deadline
    const interval = window.setInterval(tick, 250);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [endsAt]);

  return endsAt ? Math.max(0, endsAt - now) : null;
}

export function formatClock(ms) {
  const totalSeconds = Math.ceil((ms ?? 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

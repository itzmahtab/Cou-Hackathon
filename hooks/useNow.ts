'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the current timestamp in milliseconds, or `null` until the component
 * has mounted in the browser.
 *
 * Next.js prerenders Client Components on the server, so reading `Date.now()`
 * during render would bake a build-time value into the HTML and produce a
 * hydration mismatch. Deferring the read to an effect keeps the server and
 * client renders identical.
 */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Defer to a task so the state update is not part of the effect body.
    const id = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);

  return now;
}

export default useNow;

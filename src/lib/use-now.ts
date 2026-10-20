'use client';

import { useSyncExternalStore } from 'react';

/**
 * Current unix time in seconds, rounded down to `stepSeconds` so the value
 * is stable between renders. Returns null during SSR / hydration so
 * time-dependent text never causes a hydration mismatch.
 */
export function useNow(stepSeconds = 30): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, stepSeconds * 1000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 1000 / stepSeconds) * stepSeconds,
    () => null,
  );
}

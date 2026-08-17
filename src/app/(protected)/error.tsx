'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)] px-6 text-center">
      <img src="/devil-cat.png" alt="" className="w-32 h-32 object-contain opacity-60 mb-6" />
      <h1 className="text-lg font-bold text-[var(--foreground)]">Something went wrong</h1>
      <p className="text-sm text-[var(--foreground)]/50 mt-2 max-w-sm">
        Couldn&apos;t load this page — could be a temporary hiccup upstream. Try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 px-5 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}

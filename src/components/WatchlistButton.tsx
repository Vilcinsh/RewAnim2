'use client';

import { useState, useEffect } from 'react';

type Props = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
};

export default function WatchlistButton({ animeId, animeTitle, coverImage }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`/api/user/watchlist?anime_id=${animeId}`)
      .then(r => r.json())
      .then(data => setSaved(!!data.saved))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [animeId]);

  async function toggle() {
    if (toggling) return;
    setToggling(true);
    try {
      if (saved) {
        const res = await fetch(`/api/user/watchlist?anime_id=${animeId}`, { method: 'DELETE' });
        if (res.ok) setSaved(false);
      } else {
        const res = await fetch('/api/user/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anime_id: animeId, anime_title: animeTitle, cover_image: coverImage }),
        });
        if (res.ok) setSaved(true);
      }
    } catch {
      // network error — state unchanged, button returns to original
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <button disabled
        className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]/30 font-semibold rounded-lg px-4 py-2.5 text-sm opacity-50">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
        Watchlist
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      className={`inline-flex items-center gap-2 font-semibold rounded-lg px-4 py-2.5 text-sm transition-all ${
        saved
          ? 'bg-[var(--primary)]/15 border border-[var(--primary)]/40 text-[var(--primary)] hover:bg-[var(--primary)]/25'
          : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)]/70 hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
      } disabled:opacity-70 disabled:cursor-not-allowed`}
    >
      <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} stroke={saved ? 'none' : 'currentColor'} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
      </svg>
      {saved ? 'Saved' : 'Watchlist'}
    </button>
  );
}

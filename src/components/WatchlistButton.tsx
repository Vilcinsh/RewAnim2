'use client';

import { useState, useEffect } from 'react';
import { strings } from '@/lib/strings';
import { CheckIcon, PlusIcon } from '@/components/ui/icons';

type Props = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  /** `icon`: square 40px button for cards and hover previews. */
  variant?: 'default' | 'icon';
  className?: string;
};

export default function WatchlistButton({ animeId, animeTitle, coverImage, variant = 'default', className = '' }: Props) {
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

  const label = saved ? strings.actions.removeFromWatchlist : strings.actions.addToWatchlist;

  if (variant === 'icon') {
    return (
      <button type="button" onClick={toggle} disabled={loading || toggling} aria-label={label} aria-pressed={saved}
        className={`flex h-10 w-10 pointer-coarse:h-11 pointer-coarse:w-11 shrink-0 items-center justify-center rounded-chip border transition-colors disabled:opacity-60 ${
          saved ? 'border-accent-line bg-accent-soft text-accent-fg' : 'border-line-hover bg-[#26262e] text-fg hover:border-fg-2'
        } ${className}`}>
        {saved ? <CheckIcon size={16} strokeWidth={2.5} /> : <PlusIcon size={18} />}
      </button>
    );
  }

  return (
    <button type="button" onClick={toggle} disabled={loading || toggling} aria-pressed={saved}
      className={`inline-flex h-12 items-center gap-2 rounded-btn border border-line-hover bg-white/[0.08] px-[18px] text-[15px] font-semibold text-fg transition-colors hover:border-fg-2 disabled:opacity-60 ${className}`}>
      {saved ? <CheckIcon size={16} strokeWidth={2.5} /> : <PlusIcon size={16} strokeWidth={2.5} />}
      {saved ? strings.actions.inWatchlist : strings.actions.watchlist}
    </button>
  );
}

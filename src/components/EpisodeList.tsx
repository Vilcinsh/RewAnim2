'use client';

import Link from 'next/link';
import { useRef, useEffect, useState, useCallback } from 'react';

type Props = {
  animeId: number;
  totalEpisodes: number | null;
  currentEp: number;
  nextAiringEp: number | null;
};

export default function EpisodeList({ animeId, totalEpisodes, currentEp, nextAiringEp }: Props) {
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [watchedEps, setWatchedEps] = useState<Set<number>>(new Set());

  // Fetch watched episodes on mount
  useEffect(() => {
    fetch(`/api/user/progress?anime_id=${animeId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.watched)) setWatchedEps(new Set(data.watched));
      })
      .catch(() => {});
  }, [animeId]);

  // Listen for real-time episode-watched events from the player
  const handleWatched = useCallback((e: Event) => {
    const { animeId: id, episode } = (e as CustomEvent).detail;
    if (id === animeId) {
      setWatchedEps(prev => new Set([...prev, episode]));
    }
  }, [animeId]);

  useEffect(() => {
    window.addEventListener('episode-watched', handleWatched);
    return () => window.removeEventListener('episode-watched', handleWatched);
  }, [handleWatched]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [currentEp]);

  if (!totalEpisodes) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--foreground)]/30">
        Epizožu skaits nav zināms
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-[60vh] lg:max-h-[calc(100vh-12rem)]">
      {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
        const isActive = ep === currentEp;
        const isAired = !nextAiringEp || ep < nextAiringEp;
        const isWatched = watchedEps.has(ep);

        return (
          <Link
            key={ep}
            href={`/watch/${animeId}?ep=${ep}`}
            ref={isActive ? activeRef : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-b border-[var(--border)]/50 last:border-0 ${
              isActive
                ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                : isAired
                ? 'text-[var(--foreground)]/70 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]'
                : 'text-[var(--foreground)]/30 cursor-default pointer-events-none'
            }`}
          >
            <span className={`w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 ${
              isActive
                ? 'bg-[var(--primary)] text-white'
                : isWatched
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-[var(--surface-2)] text-[var(--foreground)]/50'
            }`}>
              {isActive ? '▶' : isWatched ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
              ) : ep}
            </span>
            <span className={isWatched && !isActive ? 'opacity-60' : ''}>Epizode {ep}</span>
            {isWatched && !isActive && (
              <span className="ml-auto text-xs text-emerald-500/60">Skatīta</span>
            )}
            {!isAired && !isWatched && (
              <span className="ml-auto text-xs text-[var(--foreground)]/30">Drīzumā</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

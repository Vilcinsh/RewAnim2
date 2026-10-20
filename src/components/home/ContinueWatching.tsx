'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ContinueItem } from '@/lib/db-progress';
import { strings } from '@/lib/strings';
import SectionRow from '@/components/ui/SectionRow';
import AnimeCard from '@/components/AnimeCard';

export type ContinueMedia = {
  banner: string | null;
  color: string | null;
  /** Aired episode count (null = unknown). */
  aired: number | null;
  total: number | null;
};

const H = strings.home;
const HIDDEN_KEY = 'rew:continue-hidden';
const HIDDEN_EVENT = 'rew:continue-hidden-change';

// "Removed" items are kept per browser until there's an API to hide them
// server-side. Keyed by anime+episode so the item comes back once the user
// watches further.
function subscribeHidden(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(HIDDEN_EVENT, cb);
  return () => { window.removeEventListener('storage', cb); window.removeEventListener(HIDDEN_EVENT, cb); };
}
function readHidden(): string {
  try { return localStorage.getItem(HIDDEN_KEY) ?? '[]'; } catch { return '[]'; }
}
function hide(key: string) {
  try {
    const list: string[] = JSON.parse(readHidden());
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...list.filter(k => k !== key), key].slice(-200)));
    window.dispatchEvent(new Event(HIDDEN_EVENT));
  } catch { /* storage unavailable */ }
}

type Props = { initialItems: ContinueItem[]; media: Record<number, ContinueMedia> };

export default function ContinueWatching({ initialItems, media }: Props) {
  const [items, setItems] = useState(initialItems);
  const hiddenRaw = useSyncExternalStore(subscribeHidden, readHidden, () => '[]');
  const hidden = useMemo(() => new Set<string>(JSON.parse(hiddenRaw)), [hiddenRaw]);

  // Coming back from an episode doesn't always remount the page, so refetch
  // when the tab regains focus to pick up what was just saved.
  useEffect(() => {
    function load() {
      fetch('/api/user/progress?type=continue')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data.items)) setItems(data.items); })
        .catch(() => {});
    }
    function onVisible() { if (document.visibilityState === 'visible') load(); }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, []);

  const cards = items.flatMap(it => {
    const key = `${it.animeId}:${it.episode}`;
    if (hidden.has(key)) return [];
    const m = media[it.animeId];
    const nextUp = it.durationSeconds === 0; // previous episode finished → this one is next
    if (nextUp && m?.total && it.episode > m.total) return []; // series completed
    const pct = it.durationSeconds > 0 ? it.watchedSeconds / it.durationSeconds : 0;
    if (!nextUp && pct < 0.05) return [];
    const notOut = nextUp && m?.aired != null && it.episode > m.aired;
    const minLeft = Math.max(1, Math.round((it.durationSeconds - it.watchedSeconds) / 60));
    return [{
      key,
      animeId: it.animeId,
      title: it.animeTitle,
      href: `/watch/${it.animeId}?ep=${it.episode}`,
      image: m?.banner ?? it.coverImage,
      color: m?.color ?? null,
      badge: nextUp ? H.nextBadge(it.episode) : strings.episode.short(it.episode),
      tag: nextUp ? (notOut ? H.soon : H.newTag) : H.minLeft(minLeft),
      progress: nextUp ? 0 : pct,
      subtitle: nextUp
        ? (notOut ? H.notOutYet(it.episode) : H.finishedReady(it.episode - 1, it.episode))
        : H.episodePct(it.episode, Math.round(pct * 100)),
    }];
  });

  if (!cards.length) return null;

  return (
    <SectionRow title={H.continueWatching} viewAllHref="/profile?tab=history" viewAllLabel={H.history}>
      {cards.map(c => (
        <div key={c.key} className="w-[300px] min-w-0 shrink-0 snap-start">
          <AnimeCard variant="episode" href={c.href} title={c.title} subtitle={c.subtitle}
            image={c.image} fallbackColor={c.color} badge={c.badge} tag={c.tag} progress={c.progress}
            onRemove={() => hide(c.key)} />
        </div>
      ))}
    </SectionRow>
  );
}

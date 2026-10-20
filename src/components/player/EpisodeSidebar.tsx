'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { strings } from '@/lib/strings';
import ProgressBar from '@/components/ui/ProgressBar';

export type SidebarEpisode = {
  n: number;
  title: string;
  sub: string;
  image: string | null;
  progress: number;
  future: boolean;
};

const W = strings.watch;

type Props = {
  animeId: number;
  episodes: SidebarEpisode[];
  currentEp: number;
  aired: number;
  total: number | null;
  fallbackColor: string | null;
};

export default function EpisodeSidebar({ animeId, episodes, currentEp, aired, total, fallbackColor }: Props) {
  const activeRef = useRef<HTMLAnchorElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [finished, setFinished] = useState<Set<number>>(new Set());

  // The player fires this when an episode crosses the "watched" threshold.
  const onWatched = useCallback((e: Event) => {
    const { animeId: id, episode } = (e as CustomEvent).detail;
    if (id === animeId) setFinished(prev => new Set([...prev, episode]));
  }, [animeId]);

  useEffect(() => {
    window.addEventListener('episode-watched', onWatched);
    return () => window.removeEventListener('episode-watched', onWatched);
  }, [onWatched]);

  // Scroll the current episode into view inside the list only (not the page).
  useEffect(() => {
    const list = listRef.current;
    const item = activeRef.current;
    if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
  }, [currentEp]);

  return (
    <aside className="flex w-full flex-[1_1_320px] flex-col overflow-hidden rounded-panel border border-line bg-surface xl:sticky xl:max-w-[360px]"
      style={{ top: 'calc(var(--header-h) + 16px)' }}>
      <div className="flex items-center justify-between border-b border-line px-[18px] py-4">
        <h2 className="m-0 text-[15px] font-bold">
          {W.episodes} <span className="font-medium text-muted">{total ? `${aired} / ${total}` : aired}</span>
        </h2>
      </div>
      <div ref={listRef} className="relative flex max-h-[min(720px,70vh)] flex-col overflow-y-auto">
        {episodes.map(e => {
          const cur = e.n === currentEp;
          const pct = finished.has(e.n) ? 1 : e.progress;
          const body = (
            <>
              <span className="relative h-[63px] w-28 shrink-0 overflow-hidden rounded-chip"
                style={{ background: e.future ? '#1f1f26' : fallbackColor ?? 'var(--surface-3)' }}>
                {e.image && !e.future && <Image src={e.image} alt="" fill unoptimized sizes="112px" className="object-cover" />}
                {pct > 0 && <span className="absolute inset-x-0 bottom-0"><ProgressBar value={pct} height={3} /></span>}
              </span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className={`text-xs font-bold ${cur ? 'text-accent-fg' : 'text-muted'}`}>{strings.episode.long(e.n).toUpperCase()}</span>
                <span className="truncate text-sm font-semibold">{e.title}</span>
                <span className="text-xs text-muted">{cur ? W.nowPlaying : e.sub}</span>
              </span>
            </>
          );
          const cls = `flex items-center gap-3 border-l-[3px] px-3.5 py-2.5 ${
            cur ? 'border-accent bg-accent-soft' : 'border-transparent'} ${e.future ? 'opacity-50' : 'hover:bg-surface-2'}`;
          return e.future
            ? <div key={e.n} className={cls}>{body}</div>
            : (
              <Link key={e.n} href={`/watch/${animeId}?ep=${e.n}`} ref={cur ? activeRef : undefined}
                aria-current={cur ? 'page' : undefined} className={cls}>
                {body}
              </Link>
            );
        })}
      </div>
      <Link href={`/anime/${animeId}`} className="border-t border-line px-[18px] py-3.5 text-sm font-semibold text-accent-fg hover:text-fg">
        {W.aboutAnime}
      </Link>
    </aside>
  );
}

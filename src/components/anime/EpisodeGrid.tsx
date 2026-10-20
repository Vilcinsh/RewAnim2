'use client';

import Link from 'next/link';
import { useState } from 'react';
import { strings } from '@/lib/strings';
import SegmentedControl from '@/components/ui/SegmentedControl';
import AnimeCard from '@/components/AnimeCard';
import ProgressBar from '@/components/ui/ProgressBar';

export type EpisodeView = {
  n: number;
  title: string;
  sub: string;
  tag?: string;
  progress: number;
  current: boolean;
  future: boolean;
  image: string | null;
  href: string;
};

const A = strings.anime;
const PAGE = 24;

type Props = {
  episodes: EpisodeView[];
  aired: number;
  total: number | null;
  fallbackColor: string | null;
};

export default function EpisodeGrid({ episodes, aired, total, fallbackColor }: Props) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const pages = Math.ceil(episodes.length / PAGE);
  const currentIdx = episodes.findIndex(e => e.current);
  const [page, setPage] = useState(currentIdx >= 0 ? Math.floor(currentIdx / PAGE) : 0);
  const shown = episodes.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold">
          {A.episodes} <span className="font-medium text-muted">{A.episodesOf(aired, total)}</span>
        </h2>
        <SegmentedControl label={A.view} value={view} onChange={setView}
          options={[{ value: 'grid', label: A.grid }, { value: 'list', label: A.list }]} />
      </div>

      {pages > 1 && (
        <div role="group" aria-label={A.range} className="scrollbar-hide flex gap-2 overflow-x-auto">
          {Array.from({ length: pages }, (_, i) => {
            const from = i * PAGE + 1;
            const to = Math.min((i + 1) * PAGE, episodes.length);
            return (
              <button key={i} type="button" onClick={() => setPage(i)} aria-pressed={i === page}
                className={`h-9 shrink-0 rounded-chip border px-3 text-[13px] pointer-coarse:h-11 ${
                  i === page ? 'border-accent-line bg-accent-soft font-semibold text-[#ff8a91]' : 'border-line-strong bg-surface text-fg-2 hover:text-fg'
                }`}>
                {from}–{to}
              </button>
            );
          })}
        </div>
      )}

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {shown.map(e => (
            <AnimeCard key={e.n} variant="episode" href={e.href} title={e.title} subtitle={e.sub}
              image={e.image} fallbackColor={fallbackColor} badge={strings.episode.badge(e.n)} tag={e.tag}
              progress={e.progress} current={e.current} future={e.future} />
          ))}
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col overflow-hidden rounded-panel border border-line bg-surface p-0">
          {shown.map(e => {
            const body = (
              <>
                <span className={`w-10 shrink-0 text-center text-sm font-bold tabular-nums ${e.current ? 'text-accent-fg' : 'text-muted'}`}>{e.n}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{e.title}</span>
                  <span className="text-xs text-muted">{e.sub}</span>
                  {e.progress > 0 && <ProgressBar value={e.progress} height={3} rounded className="mt-1 max-w-[220px]" />}
                </span>
                {e.tag && <span className="shrink-0 text-xs text-fg-2">{e.tag}</span>}
              </>
            );
            const cls = `flex min-h-14 items-center gap-3 px-3 py-2.5 ${
              e.current ? 'bg-accent-soft' : ''} ${e.future ? 'opacity-55' : 'hover:bg-surface-2'}`;
            return (
              <li key={e.n} className="border-b border-line last:border-0">
                {e.future ? <div className={cls}>{body}</div> : <Link href={e.href} className={cls}>{body}</Link>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

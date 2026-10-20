'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { UserPreferences, UserStats, HistoryItem } from '@/lib/db-progress';
import { strings } from '@/lib/strings';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { ChevronDownIcon, XIcon, CheckIcon } from '@/components/ui/icons';

export type Tab = 'settings' | 'history' | 'watchlist';
type Status = 'watching' | 'planned' | 'completed';
type SortKey = 'new' | 'added' | 'title';

export type WatchlistEntry = {
  animeId: number;
  title: string;
  cover: string;
  color: string | null;
  addedAt: string;
  status: Status;
  watched: number;
  aired: number;
  total: number | null;
  newEp: boolean;
  airedToday: boolean;
  nextEp: number;
};

type Props = {
  username: string;
  createdAt: string | null;
  rank: number | null;
  topGenre: string | null;
  prefs: UserPreferences;
  stats: UserStats;
  history: HistoryItem[];
  watchlist: WatchlistEntry[];
  tab: Tab;
};

const P = strings.profile;
const STATUS_DOT: Record<Status | 'all', string> = {
  all: 'bg-muted', watching: 'bg-success', planned: 'bg-planned', completed: 'bg-completed',
};

function fmtHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(dateStr: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  try { return new Date(dateStr.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', opts); } catch { return dateStr; }
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
      className="flex h-11 w-14 shrink-0 items-center justify-center">
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line-hover'}`}>
        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export default function ProfileClient({ username, createdAt, rank, topGenre, prefs, stats, history, watchlist, tab }: Props) {
  const [wl, setWl] = useState(watchlist);
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('new');

  async function remove(animeId: number) {
    const res = await fetch(`/api/user/watchlist?anime_id=${animeId}`, { method: 'DELETE' });
    if (res.ok) setWl(prev => prev.filter(i => i.animeId !== animeId));
  }

  const counts = {
    all: wl.length,
    watching: wl.filter(i => i.status === 'watching').length,
    planned: wl.filter(i => i.status === 'planned').length,
    completed: wl.filter(i => i.status === 'completed').length,
  };

  const shown = wl
    .filter(i => status === 'all' || i.status === status)
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'added') return b.addedAt.localeCompare(a.addedAt);
      const rank = (i: WatchlistEntry) => (i.newEp ? 0 : i.status === 'watching' ? 1 : i.status === 'planned' ? 2 : 3);
      return rank(a) - rank(b) || b.addedAt.localeCompare(a.addedAt);
    });

  const tabs: { id: Tab | 'stats'; label: string; count?: number; href: string }[] = [
    { id: 'watchlist', label: P.tabs.watchlist, count: wl.length, href: '/profile?tab=watchlist' },
    { id: 'history', label: P.tabs.history, count: history.length, href: '/profile?tab=history' },
    { id: 'stats', label: P.tabs.stats, href: '/stats' },
    { id: 'settings', label: P.tabs.settings, href: '/profile?tab=settings' },
  ];

  const statCards = [
    { v: fmtHours(stats.totalSeconds), k: P.stats.time },
    { v: String(stats.animeCount), k: P.stats.anime },
    { v: String(stats.episodeCount), k: P.stats.episodes },
    ...(topGenre ? [{ v: topGenre, k: P.stats.genre }] : []),
  ];
  const meta = [createdAt ? P.memberSince(fmtDate(createdAt, { month: 'short', year: 'numeric' })) : null, rank ? P.rank(rank) : null]
    .filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-6">
      {/* Profile card */}
      <section className="flex flex-wrap items-center gap-5 rounded-[16px] border border-line bg-surface p-6 md:gap-7">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-[#3a1015] text-[30px] font-extrabold text-accent-fg">
          {username[0]?.toUpperCase()}
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <h1 className="m-0 text-[26px] font-extrabold">{username}</h1>
          {meta && <span className="text-sm text-muted">{meta}</span>}
        </div>
        <div className="flex flex-wrap gap-3">
          {statCards.map(s => (
            <div key={s.k} className="flex min-w-[120px] flex-col gap-0.5 rounded-card border border-line bg-bg px-4 py-3">
              <span className="text-[22px] font-extrabold">{s.v}</span>
              <span className="text-xs text-muted">{s.k}</span>
            </div>
          ))}
        </div>
        <Link href="/stats" className="text-sm font-semibold text-accent-fg hover:text-fg">{P.leaderboard}</Link>
      </section>

      {/* Tabs */}
      <nav aria-label={P.tabsLabel} className="scrollbar-hide flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(t => {
          const active = t.id === tab;
          return (
            <Link key={t.id} href={t.href} scroll={false} aria-current={active ? 'page' : undefined}
              className={`-mb-px flex h-12 shrink-0 items-center gap-1.5 border-b-2 px-4 text-[15px] ${
                active ? 'border-accent font-bold text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}>
              {t.label}{t.count != null && <span className="font-medium text-muted">{t.count}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === 'watchlist' && (
        wl.length === 0 ? (
          <EmptyState title={P.emptyWatchlist} description={P.emptyWatchlistHint} action={{ label: strings.nav.catalog, href: '/trending' }} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div role="group" aria-label={P.statusLabel} className="flex flex-wrap gap-2">
                {(['all', 'watching', 'planned', 'completed'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
                    className={`flex h-[38px] items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold pointer-coarse:h-11 ${
                      status === s ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:border-line-hover'
                    }`}>
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden="true" />
                    {P.status[s]}<span className="font-medium text-muted">{counts[s]}</span>
                  </button>
                ))}
              </div>
              <label className="relative flex h-[38px] items-center gap-2 rounded-btn border border-line-strong bg-surface px-3.5 text-[13px] focus-within:outline focus-within:outline-2 focus-within:outline-accent-fg pointer-coarse:h-11">
                <span className="text-muted">{P.sort}</span>{P.sorts[sort]}<ChevronDownIcon size={12} strokeWidth={2.5} />
                <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label={P.sort}
                  className="absolute inset-0 cursor-pointer opacity-0">
                  {(Object.keys(P.sorts) as SortKey[]).map(k => <option key={k} value={k}>{P.sorts[k]}</option>)}
                </select>
              </label>
            </div>

            {shown.length === 0 ? <EmptyState title={P.emptyFilter} /> : (
              <div className="grid grid-cols-2 gap-x-[18px] gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {shown.map(it => {
                  const prog = it.status === 'planned' ? P.notStarted
                    : it.total ? `${it.status === 'completed' ? it.total : it.watched} / ${it.total}` : strings.episode.short(it.watched);
                  const pct = it.total ? (it.status === 'completed' ? 1 : it.watched / it.total) : 0;
                  const sub = it.status === 'watching'
                    ? [P.status.watching, it.airedToday ? P.newToday : it.newEp ? P.epOut(it.aired) : null].filter(Boolean).join(' · ')
                    : P.status[it.status];
                  return (
                    <div key={it.animeId} className="group relative flex min-w-0 flex-col gap-2">
                      <Link href={it.status === 'watching' ? `/watch/${it.animeId}?ep=${it.nextEp}` : `/anime/${it.animeId}`}
                        className="flex flex-col gap-2">
                        <span className="relative block aspect-[2/3] overflow-hidden rounded-card" style={{ background: it.color ?? 'var(--surface-3)' }}>
                          {it.cover && <Image src={it.cover} alt="" fill unoptimized sizes="200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
                          {it.newEp && <Badge variant="newEp" className="absolute left-2 top-2" />}
                          {it.status === 'completed' && (
                            <span className="absolute left-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-md bg-completed text-bg" aria-hidden="true">
                              <CheckIcon size={12} strokeWidth={3} />
                            </span>
                          )}
                          <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8">
                            <span className="text-xs font-semibold text-[#e4e4e8]">{prog}</span>
                            <ProgressBar value={pct} rounded />
                          </span>
                        </span>
                        <span className="line-clamp-2 text-sm font-semibold leading-[1.3]">{it.title}</span>
                      </Link>
                      <span className="-mt-1 text-xs text-muted">{sub}</span>
                      <button type="button" onClick={() => remove(it.animeId)} aria-label={P.remove(it.title)}
                        className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-fg hover:bg-accent"><XIcon size={14} strokeWidth={2.5} /></span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      )}

      {tab === 'history' && (
        history.length === 0 ? <EmptyState title={P.emptyHistory} action={{ label: strings.nav.catalog, href: '/trending' }} /> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {history.map(item => (
              <li key={item.animeId}>
                <Link href={`/anime/${item.animeId}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface p-2.5 transition-colors hover:border-line-hover">
                  <span className="relative h-[72px] w-[52px] shrink-0 overflow-hidden rounded-chip bg-surface-3">
                    {item.coverImage && <Image src={item.coverImage} alt="" fill unoptimized sizes="52px" className="object-cover" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{item.animeTitle}</span>
                    <span className="text-[13px] text-muted">{P.historyLine(item.completedEpisodes, fmtHours(item.totalSeconds))}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-muted">{fmtDate(item.lastWatched)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'settings' && <Settings prefs={prefs} />}
    </div>
  );
}

function Settings({ prefs }: { prefs: UserPreferences }) {
  const S = P.settings;
  const [lang, setLang] = useState<'ru' | 'en'>(prefs.language);
  const [autoSkip, setAutoSkip] = useState(prefs.autoSkip);
  const [autoPlay, setAutoPlay] = useState(prefs.autoPlay);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = useCallback(async (updates: Partial<UserPreferences>) => {
    setSaving(true);
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <section className="flex max-w-2xl flex-col gap-5 rounded-panel border border-line bg-surface p-6">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold tracking-[1px] text-muted">{S.language.toUpperCase()}</span>
        <SegmentedControl label={S.language} tone="accent" value={lang}
          onChange={l => { setLang(l); save({ language: l }); }}
          options={[{ value: 'ru', label: S.russian }, { value: 'en', label: S.english }]} className="self-start" />
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <span className="text-xs font-bold tracking-[1px] text-muted">{S.player.toUpperCase()}</span>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="m-0 text-sm">{S.autoSkip}</p>
            <p className="m-0 mt-0.5 text-xs text-muted">{S.autoSkipHint}</p>
          </div>
          <Toggle label={S.autoSkip} checked={autoSkip} onChange={() => { const n = !autoSkip; setAutoSkip(n); save({ autoSkip: n }); }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="m-0 text-sm">{S.autoPlay}</p>
            <p className="m-0 mt-0.5 text-xs text-muted">{S.autoPlayHint}</p>
          </div>
          <Toggle label={S.autoPlay} checked={autoPlay} onChange={() => { const n = !autoPlay; setAutoPlay(n); save({ autoPlay: n }); }} />
        </div>
      </div>
      <p role="status" className={`m-0 h-4 text-xs ${saved ? 'text-success' : 'text-muted'}`}>
        {saving ? S.saving : saved ? `✓ ${S.saved}` : ''}
      </p>
    </section>
  );
}

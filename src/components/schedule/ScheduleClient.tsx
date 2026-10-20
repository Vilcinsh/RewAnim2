'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { strings, formatCountdown } from '@/lib/strings';
import { useNow } from '@/lib/use-now';
import SegmentedControl from '@/components/ui/SegmentedControl';
import EmptyState from '@/components/ui/EmptyState';

export type ScheduleEntry = {
  id: number;
  title: string;
  cover: string;
  color: string | null;
  episode: number;
  airingAt: number;
  /** Minutes; used for the "airing now" window. */
  duration: number;
  inList: boolean;
};

const S = strings.schedule;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Monday 00:00 (viewer's local time) of the week containing `d`. */
function weekStart(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export default function ScheduleClient({ entries, season }: { entries: ScheduleEntry[]; season: string }) {
  const now = useNow(30);
  // Until hydrated, render in server time so markup is stable; then switch to the viewer's clock.
  const ref = now == null ? null : new Date(now * 1000);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [picked, setPicked] = useState<string | null>(null);

  // Cheap to derive each render; `now` only ticks every 30 s.
  let tz = '';
  let days: Date[] = [];
  if (ref) {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ') ?? '';
    const off = -ref.getTimezoneOffset() / 60;
    tz = `${name}, UTC${off >= 0 ? '+' : ''}${off}`;
    const start = weekStart(ref);
    days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const e of entries) {
      if (filter === 'mine' && !e.inList) continue;
      const k = dayKey(new Date(e.airingAt * 1000));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [entries, filter]);

  if (!ref) return <div className="h-[600px]" aria-busy="true" />;

  const todayKey = dayKey(ref);
  const selected = picked ?? todayKey;
  const list = byDay.get(selected) ?? [];
  const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const dayDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[32px] font-extrabold tracking-[-0.5px]">{S.title}</h1>
          <span className="text-sm text-muted">{S.subtitle(season, tz)}</span>
        </div>
        <SegmentedControl label={S.filter} value={filter} onChange={setFilter}
          options={[{ value: 'all', label: S.all }, { value: 'mine', label: S.mine }]} />
      </div>

      <div role="group" aria-label={S.days} className="grid grid-cols-7 gap-1.5 md:gap-2">
        {days.map(d => {
          const k = dayKey(d);
          const isToday = k === todayKey;
          const isSel = k === selected;
          return (
            <button key={k} type="button" onClick={() => setPicked(k)} aria-pressed={isSel}
              className={`flex h-[68px] flex-col items-center justify-center gap-1 rounded-card border transition-colors ${
                isSel ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-hover'
              }`}>
              <span className={`text-[13px] font-bold ${isSel || isToday ? 'text-accent-fg' : 'text-fg'}`}>{isToday ? S.today : dayName.format(d)}</span>
              <span className="text-xs text-muted">
                <span className="hidden sm:inline">{dayDate.format(d)} · </span>{byDay.get(k)?.length ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState title={filter === 'mine' ? S.emptyMine : S.empty} />
      ) : (
        <ol className="m-0 flex max-w-[1200px] list-none flex-col p-0">
          {list.map(e => {
            const end = e.airingAt + e.duration * 60;
            const state = now! >= end ? 'past' : now! >= e.airingAt ? 'now' : 'next';
            const status = state === 'past' ? (e.inList ? S.airedWatch : S.aired)
              : state === 'now' ? S.airingNow : S.inTime(formatCountdown(e.airingAt - now!));
            const href = state === 'next' ? `/anime/${e.id}` : `/watch/${e.id}?ep=${e.episode}`;
            return (
              <li key={`${e.id}-${e.episode}`} className="flex items-stretch gap-3 md:gap-5">
                <time dateTime={new Date(e.airingAt * 1000).toISOString()}
                  className={`w-12 shrink-0 pt-[18px] text-right text-[15px] font-bold tabular-nums md:w-16 ${state === 'now' ? 'text-accent-fg' : 'text-fg'}`}>
                  {clock.format(new Date(e.airingAt * 1000))}
                </time>
                <span className="flex w-3.5 shrink-0 flex-col items-center" aria-hidden="true">
                  <span className={`mt-[22px] h-3 w-3 rounded-full border-2 border-bg ${
                    state === 'now' ? 'bg-accent shadow-[0_0_0_2px_var(--accent)]' : state === 'past' ? 'bg-[#4a4a55] shadow-[0_0_0_2px_#4a4a55]' : 'bg-success shadow-[0_0_0_2px_var(--success)]'
                  }`} />
                  <span className="w-0.5 flex-1 bg-line" />
                </span>
                <Link href={href}
                  className={`my-1.5 flex min-w-0 flex-1 items-center gap-3.5 rounded-card border p-2.5 transition-colors ${
                    state === 'now' ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-hover'
                  } ${state === 'past' ? 'opacity-70 hover:opacity-100' : ''}`}>
                  <span className="relative h-[72px] w-[52px] shrink-0 overflow-hidden rounded-chip" style={{ background: e.color ?? 'var(--surface-3)' }}>
                    <Image src={e.cover} alt="" fill unoptimized sizes="52px" className="object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{e.title}</span>
                    <span className="text-[13px] text-muted">
                      {strings.episode.short(e.episode)}
                      <span className={`sm:hidden ${state === 'now' ? 'text-accent-fg' : state === 'past' ? 'text-success' : ''}`}> · {status}</span>
                    </span>
                  </span>
                  {e.inList && (
                    <span className="hidden shrink-0 rounded-full border border-accent-line bg-accent-soft px-[9px] py-1 text-xs font-semibold text-accent-fg sm:inline">{S.inWatchlist}</span>
                  )}
                  <span className={`hidden shrink-0 text-right text-[13px] font-semibold sm:block md:min-w-24 ${
                    state === 'now' ? 'text-accent-fg' : state === 'past' ? 'text-success' : 'text-fg-2'
                  }`}>{status}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

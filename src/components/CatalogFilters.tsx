'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mecha',
  'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller',
];

const FORMATS = [
  { value: 'TV', label: 'TV Show' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'TV_SHORT', label: 'TV Short' },
  { value: 'SPECIAL', label: 'Special' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'MUSIC', label: 'Music' },
];

const STATUSES = [
  { value: 'RELEASING', label: 'Airing' },
  { value: 'FINISHED', label: 'Finished' },
];

const SEASONS = [
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
];

const SORTS = [
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'POPULARITY_DESC', label: 'Popular' },
  { value: 'SCORE_DESC', label: 'Top Rated' },
  { value: 'TITLE_ROMAJI', label: 'A–Z' },
  { value: 'START_DATE_DESC', label: 'Newest' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => currentYear - i);

type SelectProps = {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
};

function FilterSelect({ value, onChange, options, placeholder }: SelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-[12px] px-2.5 py-1.5 rounded-lg outline-none transition-colors cursor-pointer"
      style={{
        background: value ? 'rgba(229,9,20,0.15)' : 'var(--surface)',
        color: value ? 'var(--red)' : 'var(--muted)',
        border: `1px solid ${value ? 'rgba(229,9,20,0.4)' : 'var(--border)'}`,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const get = (key: string) => searchParams.get(key) ?? '';

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }, [router, pathname, searchParams]);

  const hasFilters = ['q', 'genre', 'format', 'status', 'year', 'season', 'sort'].some(k => searchParams.has(k));

  function clearAll() {
    startTransition(() => router.push(pathname));
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="text"
          defaultValue={get('q')}
          onKeyDown={e => { if (e.key === 'Enter') update('q', (e.target as HTMLInputElement).value.trim()); }}
          onBlur={e => update('q', e.target.value.trim())}
          placeholder="Search anime..."
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        <FilterSelect
          value={get('sort')}
          onChange={v => update('sort', v)}
          options={SORTS}
          placeholder="Sort"
        />
        <FilterSelect
          value={get('genre')}
          onChange={v => update('genre', v)}
          options={GENRES.map(g => ({ value: g, label: g }))}
          placeholder="Genre"
        />
        <FilterSelect
          value={get('format')}
          onChange={v => update('format', v)}
          options={FORMATS}
          placeholder="Format"
        />
        <FilterSelect
          value={get('status')}
          onChange={v => update('status', v)}
          options={STATUSES}
          placeholder="Airing Status"
        />
        <FilterSelect
          value={get('year')}
          onChange={v => update('year', v)}
          options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
          placeholder="Year"
        />
        <FilterSelect
          value={get('season')}
          onChange={v => update('season', v)}
          options={SEASONS}
          placeholder="Season"
        />
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-[12px] px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--muted)', border: '1px solid var(--border)', background: 'var(--surface)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(229,9,20,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            Clear all ✕
          </button>
        )}
      </div>
    </div>
  );
}

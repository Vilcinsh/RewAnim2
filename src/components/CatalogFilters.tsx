'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { strings } from '@/lib/strings';
import Chip from '@/components/ui/Chip';
import { ChevronDownIcon, SearchIcon } from '@/components/ui/icons';

const C = strings.catalog;

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha',
  'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller',
];
const FORMATS = ['TV', 'MOVIE', 'TV_SHORT', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'];
const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED'];
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const SORTS = ['TRENDING_DESC', 'POPULARITY_DESC', 'SCORE_DESC', 'START_DATE_DESC', 'TITLE_ROMAJI'];

type Option = { value: string; label: string };
type FilterKey = 'sort' | 'genre' | 'format' | 'status' | 'year' | 'season';

export default function CatalogFilters({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = (key: string) => searchParams.get(key) ?? '';

  const push = useCallback((params: URLSearchParams) => {
    params.delete('page'); // any filter change starts from the top
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }, [router, pathname]);

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    push(params);
  }, [searchParams, push]);

  const options: Record<FilterKey, Option[]> = {
    sort: SORTS.map(v => ({ value: v, label: C.sorts[v] })),
    genre: GENRES.map(g => ({ value: g, label: g })),
    format: FORMATS.map(f => ({ value: f, label: strings.format[f] ?? f })),
    status: STATUSES.map(s => ({ value: s, label: strings.status[s as keyof typeof strings.status] })),
    year: Array.from({ length: 40 }, (_, i) => String(currentYear + 1 - i)).map(y => ({ value: y, label: y })),
    season: SEASONS.map(s => ({ value: s, label: C.seasons[s] })),
  };
  const labelFor = (key: FilterKey, value: string) => options[key].find(o => o.value === value)?.label ?? value;

  const q = get('q');
  const active = (['genre', 'format', 'status', 'year', 'season'] as FilterKey[])
    .filter(k => get(k))
    .map(k => ({ key: k as string, label: labelFor(k, get(k)) }));
  if (q) active.unshift({ key: 'q', label: C.search(q) });

  return (
    <div className={`flex flex-col gap-[22px] transition-opacity ${pending ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 text-[32px] font-extrabold tracking-[-0.5px]">{C.title}</h1>
        <label className="search-focus flex h-12 w-[440px] max-w-full items-center gap-2.5 rounded-btn border border-line-strong bg-surface px-3.5">
          <SearchIcon size={16} className="shrink-0 text-[#9a9aa4]" />
          <span className="sr-only">{C.filterLabel}</span>
          <input key={q} type="search" defaultValue={q} placeholder={C.filterPlaceholder}
            onKeyDown={e => { if (e.key === 'Enter') update('q', (e.target as HTMLInputElement).value.trim()); }}
            onBlur={e => { if (e.target.value.trim() !== q) update('q', e.target.value.trim()); }}
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-[#8a8a94]" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(options) as FilterKey[]).map(key => (
          <FilterSelect key={key} label={C.filters[key]} value={get(key)} options={options[key]}
            placeholder={key === 'sort' ? C.sorts[q ? 'SEARCH_MATCH' : 'TRENDING_DESC'] : C.any}
            highlight={key !== 'sort'} onChange={v => update(key, v)} />
        ))}
        <span className="flex-auto" />
        <label className="flex h-10 cursor-pointer items-center gap-2 text-[13px] text-fg-2 pointer-coarse:h-11">
          <input type="checkbox" checked={get('hideWatched') === '1'} onChange={e => update('hideWatched', e.target.checked ? '1' : '')}
            className="h-4 w-4 accent-[#e5131f]" />
          {C.hideWatched}
        </label>
      </div>

      {active.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">{C.active}</span>
          {active.map(a => (
            <Chip key={a.key} active onRemove={() => update(a.key, '')} removeLabel={C.removeFilter(a.label)}>{a.label}</Chip>
          ))}
          <button type="button" onClick={() => push(new URLSearchParams(get('sort') ? { sort: get('sort') } : {}))}
            className="h-8 px-2.5 text-[13px] text-muted underline hover:text-fg pointer-coarse:h-11">
            {C.clearAll}
          </button>
        </div>
      )}
    </div>
  );
}

/** Native select (accessible, mobile-friendly) dressed as the design's dropdown button. */
function FilterSelect({ label, value, options, placeholder, highlight, onChange }: {
  label: string; value: string; options: Option[]; placeholder: string; highlight: boolean; onChange: (v: string) => void;
}) {
  const on = highlight && !!value;
  const shown = options.find(o => o.value === value)?.label ?? placeholder;
  return (
    <label className={`relative flex h-10 items-center gap-2 rounded-btn border px-3.5 text-[13px] text-fg focus-within:outline focus-within:outline-2 focus-within:outline-accent-fg pointer-coarse:h-11 ${
      on ? 'border-accent-line bg-accent-soft' : 'border-line-strong bg-surface hover:border-line-hover'
    }`}>
      <span className="text-muted">{label}</span>
      <span>{shown}</span>
      <ChevronDownIcon size={12} strokeWidth={2.5} />
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

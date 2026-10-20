'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore, formatFormat, displayTitle, episodeLabel } from '@/lib/anilist';
import { strings } from '@/lib/strings';
import { SearchIcon, DiceIcon, ChevronDownIcon, SpinnerIcon, StarIcon } from '@/components/ui/icons';

type Props = {
  user: { name?: string | null; role: string };
};

type NavLink = { href: string; label: string; match: (path: string, tab: string | null) => boolean };

// Shared with MobileNav so both highlight the same item for a route.
export const NAV_LINKS: NavLink[] = [
  { href: '/dashboard', label: strings.nav.home, match: p => p === '/dashboard' },
  { href: '/trending', label: strings.nav.catalog, match: p => ['/trending', '/popular', '/search'].some(r => p.startsWith(r)) },
  { href: '/airing', label: strings.nav.schedule, match: p => p.startsWith('/airing') },
  { href: '/profile?tab=watchlist', label: strings.nav.watchlist, match: (p, tab) => p === '/profile' && (!tab || tab === 'watchlist') },
];

export default function Header({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get('tab');
  const [scrolled, setScrolled] = useState(false);

  // Transparent over the hero, glass once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ${
        scrolled
          ? 'border-b border-line bg-[rgba(14,14,17,0.78)] backdrop-blur-[16px] backdrop-saturate-150'
          : 'border-b border-transparent bg-gradient-to-b from-[rgba(14,14,17,0.85)] to-transparent'
      }`}
      style={{ height: 'var(--header-h)' }}
    >
      <div className="mx-auto flex h-full max-w-[1800px] items-center gap-2 px-4 sm:gap-3 md:px-8 lg:gap-5 xl:gap-6">
        <Link href="/dashboard" className="shrink-0 text-[22px] font-extrabold tracking-[-0.5px]" aria-label={`${strings.brand.first}${strings.brand.second} — ${strings.nav.home}`}>
          <span className="italic text-accent">{strings.brand.first}</span>{strings.brand.second}
        </Link>

        <nav aria-label={strings.nav.main} className="hidden flex-1 items-center gap-0.5 lg:flex xl:gap-1">
          {NAV_LINKS.map(link => {
            const active = link.match(pathname, tab);
            return (
              <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-chip px-3 py-2.5 text-sm transition-colors xl:px-3.5 ${
                  active ? 'bg-accent-soft font-semibold text-accent-fg' : 'text-[#b4b4bd] hover:bg-white/[0.04] hover:text-fg'
                }`}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <HeaderSearch pathname={pathname} />

        <RandomButton onPick={id => router.push(`/anime/${id}`)} />

        <UserMenu user={user} pathname={pathname} />
      </div>
    </header>
  );
}

function HeaderSearch({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnimeMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) return;
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const close = useCallback(() => { setOpen(false); setQuery(''); setResults([]); setSearching(false); }, []);

  // Reset on navigation (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    close();
  }

  function onChange(value: string) {
    setQuery(value);
    const empty = !value.trim();
    setSearching(!empty);
    if (empty) { setResults([]); setOpen(false); }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter' && query.trim()) {
      const q = query.trim();
      close();
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <div ref={wrapper} className="relative ml-auto min-w-0 flex-1 sm:max-w-[420px] lg:ml-0 lg:w-[240px] lg:flex-none xl:w-[320px]">
      <label className="search-focus flex h-11 items-center gap-2.5 rounded-btn border border-line-strong bg-surface-2 px-3.5">
        {searching ? <SpinnerIcon size={16} className="shrink-0 text-accent-fg" /> : <SearchIcon size={16} className="shrink-0 text-[#9a9aa4]" />}
        <span className="sr-only">{strings.search.label}</span>
        <input type="search" value={query} placeholder={strings.search.placeholder}
          onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          role="combobox" aria-expanded={open} aria-controls="header-search-results" aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-[#8a8a94] [&::-webkit-search-cancel-button]:hidden" />
      </label>

      {open && (
        <div id="header-search-results" role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-card border border-line-strong bg-surface shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
          {!searching && results.length === 0 && (
            <p className="m-0 px-4 py-4 text-center text-sm text-muted">{strings.search.noResults(query)}</p>
          )}
          {results.map(anime => {
            const score = formatScore(anime.averageScore);
            return (
              <Link key={anime.id} href={`/anime/${anime.id}`} onClick={close} role="option" aria-selected={false}
                className="flex items-center gap-3 border-b border-line px-3 py-2 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2">
                <span className="relative h-11 w-8 shrink-0 overflow-hidden rounded"
                  style={{ background: anime.coverImage.color ?? 'var(--surface-3)' }}>
                  <Image src={anime.coverImage.medium} alt="" fill className="object-cover" sizes="32px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{displayTitle(anime)}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {anime.format && <span>{formatFormat(anime.format)}</span>}
                    <span>· {episodeLabel(anime)}</span>
                    {score !== '—' && <span className="inline-flex items-center gap-0.5 text-star"><StarIcon size={10} />{score}</span>}
                  </span>
                </span>
              </Link>
            );
          })}
          {results.length > 0 && (
            <Link href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={close}
              className="flex h-11 items-center justify-center text-xs text-muted transition-colors hover:bg-surface-2 hover:text-accent-fg">
              {strings.search.seeAll}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function RandomButton({ onPick }: { onPick: (id: number) => void }) {
  const [busy, setBusy] = useState(false);
  async function roll() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/anime/random');
      const data = await res.json();
      if (data.id) onPick(data.id);
    } catch { /* ignore */ } finally { setBusy(false); }
  }
  return (
    <button type="button" onClick={roll} disabled={busy} aria-label={strings.actions.random} title={strings.actions.random}
      className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-line-strong bg-surface-2 text-[#d4d4da] transition-colors hover:border-line-hover hover:text-fg disabled:opacity-60 sm:flex">
      {busy ? <SpinnerIcon size={18} /> : <DiceIcon size={18} />}
    </button>
  );
}

function UserMenu({ user, pathname }: { user: Props['user']; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = user.name ?? 'User';

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const items = [
    { href: '/profile', label: strings.nav.profile },
    { href: '/stats', label: strings.nav.stats },
    ...(user.role === 'admin' ? [{ href: '/admin', label: strings.nav.admin }] : []),
  ];
  const item = 'flex h-11 w-full items-center px-4 text-sm text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg';

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}
        aria-label={strings.nav.userMenu}
        className="flex h-11 items-center gap-2 rounded-btn border border-line-strong bg-surface-2 px-2 text-sm text-fg transition-colors hover:border-line-hover xl:px-3">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-accent text-xs font-bold text-accent-fg">
          {name[0].toUpperCase()}
        </span>
        <span className="hidden max-w-[120px] truncate xl:inline">{name}</span>
        <ChevronDownIcon size={12} strokeWidth={2.5} className="hidden text-muted xl:block" />
      </button>

      {open && (
        <div role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-card border border-line-strong bg-surface py-1 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
          {items.map(i => (
            <Link key={i.href} href={i.href} role="menuitem" className={item}>{i.label}</Link>
          ))}
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: '/login' })}
            className={`${item} hover:text-accent-fg`}>
            {strings.nav.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

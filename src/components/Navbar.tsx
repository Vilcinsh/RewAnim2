'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore, formatFormat } from '@/lib/anilist';

type Props = {
  user: { name?: string | null; role: string };
};

const NAV_LINKS = [
  { href: '/dashboard', label: 'Home', exact: true,
    icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
  { href: '/trending', label: 'Catalog',
    icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg> },
  { href: '/airing', label: 'Schedule',
    icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-2 .9-2 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg> },
  { href: '/profile?tab=watchlist', label: 'Watchlist',
    icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M21 6.5h-3.5V3c0-.83-.67-1.5-1.5-1.5h-11C4.17 1.5 3.5 2.17 3.5 3v15c0 .83.67 1.5 1.5 1.5h3.5V21c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5V8c0-.83-.67-1.5-1.5-1.5z"/></svg> },
];

export default function Navbar({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AnimeMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = search.trim();
    if (!trimmed) { setResults([]); setOpen(false); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { setOpen(false); setSearch(''); setProfileOpen(false); }, [pathname]);

  const close = useCallback(() => { setOpen(false); setSearch(''); setResults([]); }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter' && search.trim()) {
      close();
      router.push(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  }

  function isActive(link: typeof NAV_LINKS[0]) {
    const linkPath = link.href.split('?')[0];
    if (link.exact) return pathname === linkPath;
    return pathname.startsWith(linkPath);
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center w-full px-4 gap-1">

        {/* Logo */}
        <Link href="/dashboard" className="shrink-0 flex items-center mr-4">
          <LogoImg />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-0.5 mr-2">
          {NAV_LINKS.map(link => {
            const active = isActive(link);
            return (
              <Link key={link.href} href={link.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all"
                style={{
                  color: active ? 'var(--red)' : 'rgba(255,255,255,0.6)',
                  background: active ? 'rgba(229,9,20,0.12)' : 'transparent',
                  borderBottom: active ? '2px solid var(--red)' : '2px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Search */}
        <div ref={wrapperRef} className="flex-1 flex justify-end">
          <div className="relative w-full max-w-xs search-focus rounded-lg"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center px-3 py-2 gap-2">
              {searching
                ? <svg className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--red)' }} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              }
              <input type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (results.length > 0) setOpen(true); }}
                placeholder="Search anime..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text)', minWidth: 0 }}
              />
              {/* <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0"
                style={{ background: 'var(--surface-3)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                Ctrl K
              </kbd> */}
            </div>

            {open && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl z-50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {!searching && results.length === 0 && (
                  <div className="px-4 py-4 text-sm text-center" style={{ color: 'var(--muted)' }}>
                    No results for &ldquo;{search}&rdquo;
                  </div>
                )}
                {results.map(anime => {
                  const title = anime.title.english ?? anime.title.romaji;
                  return (
                    <Link key={anime.id} href={`/anime/${anime.id}`} onClick={close}
                      className="flex items-center gap-3 px-3 py-2 transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div className="relative w-8 h-11 rounded overflow-hidden shrink-0">
                        <Image src={anime.coverImage.medium} alt={title} fill className="object-cover" sizes="32px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{title}</p>
                        <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                          {anime.format && <span>{formatFormat(anime.format)}</span>}
                          {anime.episodes && <span>· {anime.episodes} ep</span>}
                          {formatScore(anime.averageScore) !== '—' && <span>· ★ {formatScore(anime.averageScore)}</span>}
                        </p>
                      </div>
                    </Link>
                  );
                })}
                {results.length > 0 && (
                  <Link href={`/search?q=${encodeURIComponent(search.trim())}`} onClick={close}
                    className="flex items-center justify-center px-4 py-2.5 text-xs transition-colors"
                    style={{ color: 'var(--muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}>
                    See all results →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {/* Notifications */}
          {/* <button className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}>
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-black px-1"
              style={{ background: 'var(--red)', color: '#fff' }}>3</span>
          </button> */}

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 transition-colors"
              style={{ border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                style={{ background: 'var(--surface-3)', color: 'var(--red)', border: '2px solid var(--red)' }}>
                {(user.name ?? 'U')[0].toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[12px] font-semibold leading-none" style={{ color: 'var(--text)' }}>
                  {user.name ?? 'User'}
                </span>
                {/* <span className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--red)' }}>★ Premium</span> */}
              </div>
              <svg className="w-3 h-3 ml-0.5" style={{ color: 'var(--muted)' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl overflow-hidden shadow-2xl z-50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {[
                  { href: '/profile', label: 'Profile' },
                  { href: '/stats', label: 'Stats' },
                  ...(user.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
                ].map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center px-4 py-2.5 text-sm transition-colors"
                    style={{ color: 'var(--muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}>
                    {item.label}
                  </Link>
                ))}
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
                    style={{ color: 'var(--muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; }}>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function LogoImg() {
  return (
    <span className="text-[20px] font-black tracking-tight select-none leading-none">
      <span className="italic" style={{ color: 'var(--red)' }}>Rew</span>
      <span style={{ color: 'var(--text)' }}>Anime</span>
    </span>
  );
}

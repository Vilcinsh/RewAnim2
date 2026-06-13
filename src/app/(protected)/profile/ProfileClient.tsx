'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { UserPreferences, UserStats, HistoryItem, WatchlistItem } from '@/lib/db-progress';

type Props = {
  username: string;
  prefs: UserPreferences;
  stats: UserStats;
  history: HistoryItem[];
  watchlist: WatchlistItem[];
};

type Tab = 'settings' | 'history' | 'watchlist';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}>
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function fmtHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

export default function ProfileClient({ username, prefs, stats, history, watchlist }: Props) {
  const [tab, setTab] = useState<Tab>('settings');
  const [lang, setLang] = useState<'ru' | 'en'>(prefs.language);
  const [autoSkip, setAutoSkip] = useState(prefs.autoSkip);
  const [autoPlay, setAutoPlay] = useState(prefs.autoPlay);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wl, setWl] = useState<WatchlistItem[]>(watchlist);

  const savePrefs = useCallback(async (updates: Partial<UserPreferences>) => {
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

  async function removeFromWatchlist(animeId: number) {
    await fetch(`/api/user/watchlist?anime_id=${animeId}`, { method: 'DELETE' });
    setWl(prev => prev.filter(i => i.animeId !== animeId));
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'settings', label: 'Settings' },
    { id: 'history', label: `History (${history.length})` },
    { id: 'watchlist', label: `Watchlist (${wl.length})` },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-5 mb-8 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
        <div className="w-16 h-16 rounded-full bg-[var(--primary)]/20 border-2 border-[var(--primary)]/40 flex items-center justify-center text-2xl font-bold text-[var(--primary)] shrink-0">
          {username[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[var(--foreground)]">{username}</h1>
          <div className="flex flex-wrap gap-4 mt-2">
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--foreground)]">{fmtHours(stats.totalSeconds)}</p>
              <p className="text-xs text-[var(--foreground)]/40">Watch time</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--foreground)]">{stats.animeCount}</p>
              <p className="text-xs text-[var(--foreground)]/40">Anime</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--foreground)]">{stats.episodeCount}</p>
              <p className="text-xs text-[var(--foreground)]/40">Episodes</p>
            </div>
          </div>
        </div>
        <Link href="/stats" className="text-xs text-[var(--foreground)]/40 hover:text-[var(--primary)] transition-colors whitespace-nowrap">
          Leaderboard →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--foreground)]/50 hover:text-[var(--foreground)]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-5">
          {/* Language */}
          <div>
            <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-3 font-semibold">Default language</p>
            <div className="flex rounded-lg overflow-hidden border border-[var(--border)] text-sm font-semibold w-fit">
              {(['ru', 'en'] as const).map(l => (
                <button key={l} onClick={() => { setLang(l); savePrefs({ language: l }); }}
                  className={`px-5 py-2 transition-colors ${lang === l ? 'bg-[var(--primary)] text-white' : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]'}`}>
                  {l === 'ru' ? '🇷🇺 Russian' : '🇬🇧 English'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-5 space-y-4">
            <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest font-semibold">Player</p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--foreground)]">Auto-skip intro & outro</p>
                <p className="text-xs text-[var(--foreground)]/40 mt-0.5">Automatically skip intro and outro segments</p>
              </div>
              <Toggle checked={autoSkip} onChange={() => { const n = !autoSkip; setAutoSkip(n); savePrefs({ autoSkip: n }); }} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--foreground)]">Auto-play next episode</p>
                <p className="text-xs text-[var(--foreground)]/40 mt-0.5">Automatically start next episode after 5 seconds</p>
              </div>
              <Toggle checked={autoPlay} onChange={() => { const n = !autoPlay; setAutoPlay(n); savePrefs({ autoPlay: n }); }} />
            </div>
          </div>

          {(saving || saved) && (
            <div className={`text-xs mt-2 transition-opacity ${saved ? 'text-emerald-400' : 'text-[var(--foreground)]/40'}`}>
              {saving ? 'Saving...' : '✓ Saved'}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="text-center py-16 text-[var(--foreground)]/30">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
              <p className="text-sm">No watch history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(item => (
                <Link key={item.animeId} href={`/anime/${item.animeId}`}
                  className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 hover:border-[var(--primary)]/40 transition-colors group">
                  <div className="relative w-10 h-14 rounded-lg overflow-hidden shrink-0 bg-[var(--surface-2)]">
                    {item.coverImage && (
                      <Image src={item.coverImage} alt={item.animeTitle} fill className="object-cover" sizes="40px" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors truncate">
                      {item.animeTitle}
                    </p>
                    <p className="text-xs text-[var(--foreground)]/40 mt-0.5">
                      {item.completedEpisodes} ep watched · {fmtHours(item.totalSeconds)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[var(--foreground)]/40">{fmtDate(item.lastWatched)}</p>
                    {item.completedEpisodes > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 mt-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                        {item.completedEpisodes}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Watchlist tab */}
      {tab === 'watchlist' && (
        <div>
          {wl.length === 0 ? (
            <div className="text-center py-16 text-[var(--foreground)]/30">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="currentColor" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
              <p className="text-sm">Your watchlist is empty</p>
              <p className="text-xs mt-1 opacity-60">Add anime from their page to save for later</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {wl.map(item => (
                <div key={item.animeId} className="relative group">
                  <Link href={`/anime/${item.animeId}`}
                    className="block bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--primary)]/50 transition-colors">
                    <div className="relative w-full aspect-[2/3] bg-[var(--surface-2)]">
                      {item.coverImage && (
                        <Image src={item.coverImage} alt={item.animeTitle} fill className="object-cover" sizes="200px" />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-[var(--foreground)] line-clamp-2">{item.animeTitle}</p>
                      <p className="text-xs text-[var(--foreground)]/30 mt-1">{fmtDate(item.addedAt)}</p>
                    </div>
                  </Link>
                  <button
                    onClick={() => removeFromWatchlist(item.animeId)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-[var(--primary)] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs"
                    title="Remove">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

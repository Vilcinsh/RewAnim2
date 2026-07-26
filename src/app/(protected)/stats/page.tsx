import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getWeeklyTopWatchers, getWeeklyTopAnime } from '@/lib/db-progress';
import Image from 'next/image';
import Link from 'next/link';

function fmtHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const topWatchers = getWeeklyTopWatchers(10);
  const topAnime = getWeeklyTopAnime(20);

  return (
    <div className="container mx-auto px-4 pt-20 pb-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Weekly Leaderboard</h1>
        <p className="text-sm text-[var(--foreground)]/40 mt-1">Last 7 days statistics</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Watchers */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--primary)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            Top Watchers
          </h2>
          {topWatchers.length === 0 ? (
            <p className="text-sm text-[var(--foreground)]/30 text-center py-8">No data yet this week</p>
          ) : (
            <div className="space-y-2">
              {topWatchers.map((w, i) => (
                <div key={w.userId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                  i === 0 ? 'bg-yellow-400/10 border border-yellow-400/20' :
                  i === 1 ? 'bg-slate-400/10 border border-slate-400/20' :
                  i === 2 ? 'bg-amber-700/10 border border-amber-700/20' :
                  'bg-[var(--surface-2)] border border-transparent'
                }`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-yellow-400 text-black' :
                    i === 1 ? 'bg-slate-400 text-black' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-[var(--border)] text-[var(--foreground)]/60'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center text-sm font-bold text-[var(--primary)] shrink-0">
                    {w.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{w.username}</p>
                    <p className="text-xs text-[var(--foreground)]/40">{w.animeCount} anime</p>
                  </div>
                  <span className="text-sm font-bold text-[var(--foreground)] shrink-0">{fmtHours(w.totalSeconds)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Anime */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[var(--primary)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/>
            </svg>
            Top Anime
          </h2>
          {topAnime.length === 0 ? (
            <p className="text-sm text-[var(--foreground)]/30 text-center py-8">No data yet this week</p>
          ) : (
            <div className="space-y-2">
              {topAnime.slice(0, 10).map((a, i) => (
                <Link key={a.animeId} href={`/anime/${a.animeId}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--primary)]/30 transition-colors group">
                  <span className="text-xs text-[var(--foreground)]/40 w-5 text-center shrink-0 font-bold">
                    {i + 1}
                  </span>
                  <div className="relative w-8 h-11 rounded-lg overflow-hidden shrink-0 bg-[var(--surface)]">
                    {a.coverImage && (
                      <Image src={a.coverImage} alt={a.animeTitle} fill className="object-cover" sizes="32px" />
                    )}
                  </div>
                  <p className="text-sm text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors truncate flex-1">
                    {a.animeTitle}
                  </p>
                  <span className="text-xs text-[var(--foreground)]/40 shrink-0">
                    {a.viewerCount} {a.viewerCount === 1 ? 'viewer' : 'viewers'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore } from '@/lib/anilist';

function formatCountdown(airingAt: number): string {
  const diff = airingAt - Date.now() / 1000;
  if (diff <= 0) return 'Airing now';
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return `in ${days}d ${h}h`;
  }
  return `in ${hours}h ${minutes}m`;
}

type Props = { trending: AnimeMedia[]; airing: AnimeMedia[] };

export default function RightPanel({ trending, airing }: Props) {
  const top10 = trending.slice(0, 10);
  const upcoming = airing
    .filter(a => a.nextAiringEpisode && a.nextAiringEpisode.airingAt > Date.now() / 1000)
    .sort((a, b) => a.nextAiringEpisode!.airingAt - b.nextAiringEpisode!.airingAt)
    .slice(0, 5);

  return (
    <aside className="fixed top-14 right-0 bottom-0 w-[260px] z-40 overflow-y-auto scrollbar-hide hidden xl:block"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>

      {/* TOP 10 TODAY */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
              <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
            </svg>
            Top 10 Today
          </h3>
          <Link href="/trending" className="text-[11px] font-medium" style={{ color: 'var(--red)' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
            View All
          </Link>
        </div>

        <div className="space-y-0.5">
          {top10.map((anime, i) => {
            const title = anime.title.english ?? anime.title.romaji;
            const score = formatScore(anime.averageScore);
            const trendCount = Math.max(4, 14 - i * 1.2 | 0);
            const ep = anime.nextAiringEpisode?.episode
              ? anime.nextAiringEpisode.episode - 1
              : anime.episodes ?? 1;
            return (
              <Link key={anime.id} href={`/anime/${anime.id}`}
                className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg transition-colors group"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {/* Rank */}
                <span className="text-sm font-black w-4 shrink-0 text-center tabular-nums"
                  style={{ color: i < 3 ? 'var(--red)' : 'rgba(255,255,255,0.2)' }}>
                  {i + 1}
                </span>
                {i < 3 && <div className="w-0.5 h-6 rounded-full shrink-0" style={{ background: 'var(--red)' }} />}
                {/* Thumbnail */}
                <div className="relative w-8 h-11 rounded overflow-hidden shrink-0" style={{ background: 'var(--surface-2)' }}>
                  <Image src={anime.coverImage.extraLarge} alt={title} fill quality={90} className="object-cover" sizes="32px" />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold line-clamp-1 group-hover:text-[var(--red)] transition-colors" style={{ color: 'var(--text)' }}>
                    {title}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Ep {ep}
                    {score !== '—' && <span> · ★ {score}</span>}
                  </p>
                </div>
                {/* Trend count */}
                <span className="text-[10px] font-bold flex items-center gap-0.5 shrink-0" style={{ color: 'var(--red)' }}>
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
                  {trendCount}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* UPCOMING EPISODES */}
      {upcoming.length > 0 && (
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              Upcoming Episodes
            </h3>
            <Link href="/airing" className="text-[11px] font-medium" style={{ color: 'var(--red)' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
              View Schedule
            </Link>
          </div>

          <div className="space-y-2">
            {upcoming.map(anime => {
              const title = anime.title.english ?? anime.title.romaji;
              const ep = anime.nextAiringEpisode!;
              return (
                <Link key={anime.id} href={`/anime/${anime.id}`}
                  className="flex items-center gap-2.5 px-2 py-2 -mx-2 rounded-lg transition-colors group"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="relative w-10 h-14 rounded overflow-hidden shrink-0" style={{ background: 'var(--surface-2)' }}>
                    <Image src={anime.coverImage.extraLarge} alt={title} fill quality={90} className="object-cover" sizes="40px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold line-clamp-1 group-hover:text-[var(--red)] transition-colors" style={{ color: 'var(--text)' }}>
                      {title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Ep {ep.episode}
                    </p>
                    <p className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--red)' }}>
                      {formatCountdown(ep.airingAt)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

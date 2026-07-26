import { getAnimeById, formatScore, formatStatus, formatFormat } from '@/lib/anilist';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import WatchlistButton from '@/components/WatchlistButton';

type Props = { params: Promise<{ id: string }> };

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

export default async function AnimePage({ params }: Props) {
  const { id } = await params;
  const anime = await getAnimeById(Number(id));
  if (!anime) notFound();

  const title = anime.title.english ?? anime.title.romaji;
  const score = formatScore(anime.averageScore);
  const desc = anime.description ? stripHtml(anime.description) : null;
  const now = Date.now();
  const nextAiring = anime.nextAiringEpisode;
  const nextIsStale = nextAiring && nextAiring.airingAt * 1000 < now;
  const totalEps = (!nextAiring || nextIsStale) ? anime.episodes : nextAiring.episode - 1;

  return (
    <>
      <div className="pt-14 pb-16">

        {/* ── Banner ── */}
        <div className="relative w-full overflow-hidden" style={{ height: 340 }}>
          {anime.bannerImage ? (
            <Image src={anime.bannerImage} alt="" fill quality={90} className="object-cover" sizes="100vw" priority />
          ) : (
            <div className="w-full h-full" style={{ background: 'var(--surface-2)' }} />
          )}
          {/* Overlays */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg,var(--bg) 0%,rgba(9,9,11,0.5) 50%,rgba(9,9,11,0.2) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,rgba(9,9,11,0.7) 0%,transparent 60%)' }} />
        </div>

        {/* ── Main content ── */}
        <div className="px-6 -mt-24 relative z-10">
          <div className="flex gap-6 items-end">

            {/* Cover */}
            <div className="shrink-0">
              <div className="relative rounded-xl overflow-hidden shadow-2xl"
                style={{ width: 160, height: 230, border: '3px solid rgba(255,255,255,0.08)' }}>
                <Image src={anime.coverImage.extraLarge} alt={title} fill quality={95} className="object-cover" sizes="160px" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-2">
              {/* Status badge */}
              {anime.status === 'RELEASING' && (
                <span className="inline-block text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-2"
                  style={{ background: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  Airing Now
                </span>
              )}
              <h1 className="text-3xl font-black text-white leading-tight mb-1">{title}</h1>
              {anime.title.romaji !== title && (
                <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>{anime.title.romaji}</p>
              )}

              {/* Meta pills */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {score !== '—' && (
                  <span className="flex items-center gap-1 font-bold text-sm px-3 py-1 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                    ★ {score}
                  </span>
                )}
                {anime.seasonYear && (
                  <span className="text-sm px-3 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {anime.seasonYear}
                  </span>
                )}
                {anime.format && (
                  <span className="text-sm px-3 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {formatFormat(anime.format)}
                  </span>
                )}
                {totalEps && (
                  <span className="text-sm px-3 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {totalEps} Episodes
                  </span>
                )}
                <span className="text-sm px-3 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                  {formatStatus(anime.status)}
                </span>
              </div>

              {/* Genres */}
              {anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {anime.genres.map(g => (
                    <span key={g} className="text-[12px] px-2.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(229,9,20,0.1)', color: 'rgba(229,9,20,0.85)', border: '1px solid rgba(229,9,20,0.2)' }}>
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-wrap gap-2">
                <Link href={`/watch/${anime.id}?ep=1`}
                  className="flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--red)', color: '#fff', boxShadow: '0 4px 20px rgba(229,9,20,0.35)' }}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Watch Now
                </Link>
                <WatchlistButton animeId={anime.id} animeTitle={title} coverImage={anime.coverImage.extraLarge} />
              </div>
            </div>
          </div>

          {/* Studio + next ep */}
          <div className="mt-5 flex flex-wrap gap-4 text-sm" style={{ color: 'var(--muted)' }}>
            {anime.studios.nodes.length > 0 && (
              <span>Studio: <span className="text-white">{anime.studios.nodes[0].name}</span></span>
            )}
          </div>
          {nextAiring && !nextIsStale && (
            <div className="mt-3 inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl"
              style={{ background: 'rgba(229,9,20,0.08)', color: 'var(--red)', border: '1px solid rgba(229,9,20,0.2)' }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm.01 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
              Next: Episode {nextAiring.episode} —{' '}
              {new Date(nextAiring.airingAt * 1000).toLocaleDateString('en', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </div>
          )}

          {/* Synopsis */}
          {desc && (
            <div className="mt-6 rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-[13px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--red)' }}>Synopsis</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{desc}</p>
            </div>
          )}

          {/* Episodes grid */}
          {totalEps && (
            <div className="mt-6">
              <h2 className="text-[13px] font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--red)' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                Episodes
                <span className="text-sm font-normal ml-1" style={{ color: 'var(--muted)' }}>({totalEps})</span>
              </h2>
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px" style={{ background: 'var(--border)' }}>
                  {Array.from({ length: Math.min(totalEps, 50) }, (_, i) => i + 1).map(ep => (
                    <Link key={ep} href={`/watch/${anime.id}?ep=${ep}`}
                      className="ep-cell flex items-center justify-center py-3 text-sm font-medium transition-colors"
                      style={{ background: 'var(--surface)', color: 'rgba(255,255,255,0.6)' }}
                      prefetch={false}>
                      Ep {ep}
                    </Link>
                  ))}
                </div>
                {totalEps > 50 && (
                  <div className="px-4 py-3 text-center text-sm" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                    + {totalEps - 50} more episodes · <Link href={`/watch/${anime.id}?ep=1`} style={{ color: 'var(--red)' }}>Watch from Ep 1</Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

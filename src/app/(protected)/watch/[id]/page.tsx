import { getAnimeById } from '@/lib/anilist';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import EpisodeList from '@/components/EpisodeList';
import WatchClient from '@/components/player/WatchClient';
import WatchlistButton from '@/components/WatchlistButton';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ep?: string }>;
};

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ep } = await searchParams;
  const anime = await getAnimeById(Number(id));
  if (!anime) notFound();

  const title = anime.title.english ?? anime.title.romaji;
  const currentEp = Math.max(1, Number(ep) || 1);
  const nextAiring = anime.nextAiringEpisode;
  const nextIsStale = nextAiring && nextAiring.airingAt * 1000 < Date.now();
  const totalEpisodes = (!nextAiring || nextIsStale) ? anime.episodes : nextAiring.episode - 1;
  const hasNextEpisode = totalEpisodes != null ? currentEp < totalEpisodes : false;

  return (
    <>
      <div className="pt-14 pb-8">
        <div className="flex flex-col xl:flex-row gap-0">

          {/* ── Left: player + info ── */}
          <div className="flex-1 min-w-0">

            {/* Player */}
            <div style={{ background: '#000' }}>
              <WatchClient
                animeId={anime.id}
                malId={anime.idMal}
                currentEp={currentEp}
                hasNextEpisode={hasNextEpisode}
                animeTitle={title}
                coverImage={anime.coverImage.extraLarge}
                genres={anime.genres}
              />
            </div>

            {/* Info bar below player */}
            <div className="px-5 py-4" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-start gap-4">
                {/* Cover thumb */}
                <Link href={`/anime/${anime.id}`} className="shrink-0">
                  <div className="relative rounded-lg overflow-hidden" style={{ width: 52, height: 72 }}>
                    <Image src={anime.coverImage.extraLarge} alt={title} fill quality={90} className="object-cover" sizes="52px" />
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/anime/${anime.id}`}>
                        <h1 className="text-base font-bold leading-snug line-clamp-1 hover:text-[var(--red)] transition-colors" style={{ color: 'var(--text)' }}>
                          {title}
                        </h1>
                      </Link>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                        Episode {currentEp}
                        {totalEpisodes && <span> / {totalEpisodes}</span>}
                        {anime.status === 'RELEASING' && (
                          <span className="ml-2 font-bold" style={{ color: 'var(--red)' }}>· Ongoing</span>
                        )}
                      </p>
                      {anime.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {anime.genres.slice(0, 4).map(g => (
                            <span key={g} className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(229,9,20,0.1)', color: 'rgba(229,9,20,0.75)', border: '1px solid rgba(229,9,20,0.15)' }}>
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <WatchlistButton animeId={anime.id} animeTitle={title} coverImage={anime.coverImage.extraLarge} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prev / Next episode */}
              <div className="flex gap-2 mt-4">
                {currentEp > 1 ? (
                  <Link href={`/watch/${anime.id}?ep=${currentEp - 1}`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    Ep {currentEp - 1}
                  </Link>
                ) : <div />}
                {hasNextEpisode && (
                  <Link href={`/watch/${anime.id}?ep=${currentEp + 1}`}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold ml-auto transition-all hover:scale-[1.02]"
                    style={{ background: 'var(--red)', color: '#fff' }}>
                    Next: Ep {currentEp + 1}
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: episode list ── */}
          <div className="xl:w-72 shrink-0 xl:sticky xl:top-14 xl:self-start xl:max-h-[calc(100vh-3.5rem)] xl:overflow-hidden flex flex-col"
            style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>

            {/* Panel header */}
            <div className="px-4 py-3 shrink-0 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                </svg>
                <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                  Episodes
                  {totalEpisodes && <span className="ml-1 font-normal" style={{ color: 'var(--muted)' }}>({totalEpisodes})</span>}
                </h2>
              </div>
              <Link href={`/anime/${anime.id}`} className="text-[11px] font-medium" style={{ color: 'var(--red)' }}>
                Details →
              </Link>
            </div>

            {/* Cover + mini info */}
            <div className="px-4 py-3 flex items-center gap-3 shrink-0"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div className="relative w-10 h-14 rounded overflow-hidden shrink-0">
                <Image src={anime.coverImage.extraLarge} alt={title} fill quality={85} className="object-cover" sizes="40px" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold line-clamp-2 leading-snug" style={{ color: 'var(--text)' }}>{title}</p>
                {anime.averageScore && (
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: '#fbbf24' }}>
                    ★ {(anime.averageScore / 10).toFixed(1)}
                  </p>
                )}
              </div>
            </div>

            {/* Episode list */}
            <EpisodeList
              animeId={anime.id}
              totalEpisodes={totalEpisodes}
              currentEp={currentEp}
              nextAiringEp={(!nextIsStale && nextAiring) ? nextAiring.episode : null}
            />
          </div>

        </div>
      </div>
    </>
  );
}

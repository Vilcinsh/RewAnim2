import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getAnimeDetails, getRecommendationsFor, airedEpisodes, displayTitle, streamingEpisodeMap,
} from '@/lib/anilist';
import { getEpisodeProgress } from '@/lib/db-progress';
import { strings } from '@/lib/strings';
import { formatDayDate, formatShortDate, nowUnix } from '@/lib/time';
import WatchClient from '@/components/player/WatchClient';
import EpisodeSidebar, { type SidebarEpisode } from '@/components/player/EpisodeSidebar';
import SectionRow from '@/components/ui/SectionRow';
import AnimeCard from '@/components/AnimeCard';
import HoverPreview from '@/components/HoverPreview';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ep?: string }>;
};

const W = strings.watch;
const A = strings.anime;
const WATCHED_AT = 0.85;
const NEW_WINDOW = 7 * 86400;

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ep } = await searchParams;
  const anime = await getAnimeDetails(Number(id));
  if (!anime) notFound();

  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const progress = userId ? getEpisodeProgress(userId, anime.id) : [];
  const [recs] = await getRecommendationsFor([anime.id], 12);
  const now = nowUnix();

  const title = displayTitle(anime);
  const currentEp = Math.max(1, Number(ep) || 1);
  const aired = airedEpisodes(anime) ?? anime.episodes ?? currentEp;
  const total = anime.episodes;
  const hasNextEpisode = currentEp < aired;

  const stream = streamingEpisodeMap(anime.streamingEpisodes);
  const airTimes = new Map(anime.airingSchedule.map(s => [s.episode, s.airingAt]));
  const progressByEp = new Map(progress.map(p => [p.episode, p]));
  const shown = Math.max(currentEp, total ? Math.min(total, aired + 2) : aired + (anime.nextAiringEpisode ? 2 : 0));

  const episodes: SidebarEpisode[] = Array.from({ length: shown }, (_, i) => {
    const n = i + 1;
    const future = n > aired;
    const at = airTimes.get(n);
    const p = progressByEp.get(n);
    const pct = p && p.durationSeconds > 0 ? p.watchedSeconds / p.durationSeconds : 0;
    const sub = future
      ? (at ? formatDayDate(at) : A.upcoming)
      : pct >= WATCHED_AT ? A.watched
      : at && now - at < NEW_WINDOW && pct === 0 ? `${A.newEp} · ${formatShortDate(at)}`
      : at ? formatShortDate(at) : strings.episode.long(n);
    return {
      n,
      title: stream.get(n)?.title ?? strings.episode.long(n),
      sub,
      image: stream.get(n)?.thumbnail ?? anime.bannerImage ?? null,
      progress: pct,
      future,
    };
  });

  const epTitle = stream.get(currentEp)?.title ?? null;
  const navBtn = 'flex h-11 items-center gap-1.5 rounded-btn px-4 text-sm font-semibold transition-colors';

  const titleRow = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <Link href={`/anime/${anime.id}`} className="relative h-[68px] w-12 shrink-0 overflow-hidden rounded-chip"
          style={{ background: anime.coverImage.color ?? '#4a3a5a' }} aria-label={title}>
          <Image src={anime.coverImage.medium} alt="" fill sizes="48px" className="object-cover" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="m-0 text-lg font-bold md:text-[22px]">{W.episodeTitle(currentEp, epTitle)}</h1>
          <Link href={`/anime/${anime.id}`} className="truncate text-sm text-muted hover:text-fg">
            {title} · {total ? `${currentEp} / ${total}` : currentEp}
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {currentEp > 1 && (
          <Link href={`/watch/${anime.id}?ep=${currentEp - 1}`} aria-label={W.prev}
            className={`${navBtn} border border-line-hover bg-surface-2 hover:border-fg-2`}>
            <ChevronLeftIcon size={14} strokeWidth={2.5} />{strings.episode.short(currentEp - 1)}
          </Link>
        )}
        {hasNextEpisode && (
          <Link href={`/watch/${anime.id}?ep=${currentEp + 1}`} aria-label={W.next}
            className={`${navBtn} bg-accent font-bold text-white hover:bg-[#f0202c]`}>
            {strings.episode.short(currentEp + 1)}<ChevronRightIcon size={14} strokeWidth={2.5} />
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-[1760px] flex-col gap-5 px-4 pb-24 md:px-6 md:pb-16 2xl:px-8"
      style={{ paddingTop: 'calc(var(--header-h) + 20px)' }}>
      <nav aria-label={W.breadcrumb} className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <Link href={`/anime/${anime.id}`} className="text-fg-2 hover:text-fg">{title}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-fg" aria-current="page">{strings.episode.long(currentEp)}</span>
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_760px] flex-col">
          <WatchClient
            animeId={anime.id}
            malId={anime.idMal}
            currentEp={currentEp}
            hasNextEpisode={hasNextEpisode}
            animeTitle={title}
            coverImage={anime.coverImage.extraLarge}
            genres={anime.genres}
            belowPlayer={titleRow}
          />
        </div>
        <EpisodeSidebar animeId={anime.id} episodes={episodes} currentEp={currentEp}
          aired={aired} total={total} fallbackColor={anime.coverImage.color} />
      </div>

      {recs && recs.items.length > 0 && (
        <SectionRow title={W.becauseWatching} className="mt-3">
          {recs.items.map(a => (
            <HoverPreview key={a.id} anime={a} className="shrink-0 snap-start">
              <div className="w-[160px] min-w-0">
                <AnimeCard anime={a} sizes="160px" />
              </div>
            </HoverPreview>
          ))}
        </SectionRow>
      )}
    </div>
  );
}

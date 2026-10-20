import Image from 'next/image';
import { ViewTransition } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getAnimeDetails, formatScore, formatStatus, formatFormat, airedEpisodes, displayTitle, streamingEpisodeMap,
  type AnimeMedia,
} from '@/lib/anilist';
import { getEpisodeProgress } from '@/lib/db-progress';
import { strings } from '@/lib/strings';
import { formatDayDate, formatShortDate, nowUnix } from '@/lib/time';
import Badge from '@/components/ui/Badge';
import Chip from '@/components/ui/Chip';
import CountdownRing from '@/components/ui/CountdownRing';
import ClampText from '@/components/ui/ClampText';
import CopyLinkButton from '@/components/ui/CopyLinkButton';
import WatchlistButton from '@/components/WatchlistButton';
import EpisodeGrid, { type EpisodeView } from '@/components/anime/EpisodeGrid';
import { PlayIcon, StarIcon } from '@/components/ui/icons';
import { animeAccentVars, genreTint } from '@/lib/accent';

type Props = { params: Promise<{ id: string }> };

const A = strings.anime;
const WATCHED_AT = 0.85;
const NEW_WINDOW = 7 * 86400;
const FUTURE_SHOWN = 3;
const HIDDEN_RELATIONS = new Set(['CHARACTER', 'OTHER', 'COMPILATION', 'CONTAINS']);

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&[^;\s]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleCase(s: string) {
  const t = s.replace(/_/g, ' ').toLowerCase();
  return t[0].toUpperCase() + t.slice(1);
}

// AniList doesn't always have nextAiringEpisode (and the Kitsu fallback never
// does); estimate aired episodes from a weekly cadence since the premiere.
function estimateAiredFromWeeklySchedule(startDate: AnimeMedia['startDate'], episodeCount: number | null, now: number): number | null {
  if (!startDate?.year || !startDate.month || !startDate.day) return null;
  const start = Date.UTC(startDate.year, startDate.month - 1, startDate.day) / 1000;
  const days = Math.floor((now - start) / 86400);
  if (days < 0) return null;
  const aired = Math.floor(days / 7) + 1;
  return episodeCount ? Math.min(aired, episodeCount) : aired;
}

export default async function AnimePage({ params }: Props) {
  const { id } = await params;
  const anime = await getAnimeDetails(Number(id));
  if (!anime) notFound();

  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const progress = userId ? getEpisodeProgress(userId, anime.id) : [];
  const now = nowUnix();

  const title = displayTitle(anime);
  const score = formatScore(anime.averageScore);
  const desc = anime.description ? stripHtml(anime.description) : null;
  const next = anime.nextAiringEpisode && anime.nextAiringEpisode.airingAt > now ? anime.nextAiringEpisode : null;
  const aired = (anime.status === 'RELEASING' && !next
    ? estimateAiredFromWeeklySchedule(anime.startDate, anime.episodes, now)
    : airedEpisodes(anime)) ?? 0;
  const total = anime.episodes;
  const season = anime.season && anime.seasonYear ? `${titleCase(anime.season)} ${anime.seasonYear}` : anime.seasonYear ? String(anime.seasonYear) : null;
  const studio = anime.studios?.nodes?.[0]?.name ?? null;

  // ── Per-episode state
  const progressByEp = new Map(progress.map(p => [p.episode, p]));
  const pctOf = (ep: number) => {
    const p = progressByEp.get(ep);
    return p && p.durationSeconds > 0 ? p.watchedSeconds / p.durationSeconds : 0;
  };
  const latest = progress[0];
  let cta: { ep: number; label: string; sub?: string } = { ep: 1, label: A.watchEp(1) };
  if (latest) {
    const pct = pctOf(latest.episode);
    if (pct < WATCHED_AT) {
      const left = Math.max(1, Math.round((latest.durationSeconds - latest.watchedSeconds) / 60));
      cta = { ep: latest.episode, label: A.continueEp(latest.episode), sub: latest.durationSeconds > 0 ? A.minLeft(left) : undefined };
    } else if (latest.episode + 1 <= Math.max(aired, 1)) {
      cta = { ep: latest.episode + 1, label: A.watchEp(latest.episode + 1) };
    } else {
      cta = { ep: latest.episode, label: A.watchEp(latest.episode) };
    }
  }

  const airTimes = new Map(anime.airingSchedule.map(s => [s.episode, s.airingAt]));
  const stream = streamingEpisodeMap(anime.streamingEpisodes);
  const visible = total ? Math.min(total, aired + FUTURE_SHOWN) : aired + (next ? FUTURE_SHOWN : 0);
  const durationTag = anime.duration ? `${anime.duration}:00` : undefined;
  const episodes: EpisodeView[] = Array.from({ length: visible }, (_, i) => {
    const n = i + 1;
    const future = n > aired;
    const at = airTimes.get(n);
    const pct = pctOf(n);
    const isNew = !future && at != null && now - at < NEW_WINDOW && pct === 0;
    const status = future
      ? (at ? A.airs(formatDayDate(at)) : A.upcoming)
      : pct >= WATCHED_AT ? A.watched
      : pct > 0 ? A.minLeft(Math.max(1, Math.round(((progressByEp.get(n)!.durationSeconds - progressByEp.get(n)!.watchedSeconds)) / 60)))
      : isNew ? A.newEp : null;
    const date = !future && at ? formatShortDate(at) : null;
    const s = stream.get(n);
    return {
      n,
      title: s?.title ?? strings.episode.long(n),
      sub: [date, status].filter(Boolean).join(' · ') || strings.episode.long(n),
      tag: future ? A.soon : isNew ? A.newTag : durationTag,
      progress: pct,
      current: n === cta.ep && !!latest,
      future,
      image: s?.thumbnail ?? anime.bannerImage ?? null,
      href: `/watch/${anime.id}?ep=${n}`,
    };
  });

  const info = [
    { k: A.info.format, v: formatFormat(anime.format) || null },
    { k: A.info.episodes, v: total ? String(total) : null },
    { k: A.info.duration, v: anime.duration ? A.minutes(anime.duration) : null },
    { k: A.info.season, v: season },
    { k: A.info.studio, v: studio },
    { k: A.info.source, v: anime.source ? titleCase(anime.source) : null },
    { k: A.info.status, v: formatStatus(anime.status) },
  ].filter(i => i.v);

  const related = anime.relations.filter(r => !HIDDEN_RELATIONS.has(r.relationType));

  return (
    // Per-anime accent (from the cover colour) scoped to this page; header stays brand red.
    <div className="relative overflow-x-clip pb-24 lg:pb-16" style={animeAccentVars(anime.coverImage.color) ?? undefined}>
      {/* Banner */}
      <section className="relative h-[300px] overflow-hidden md:h-[340px]" style={{ background: anime.coverImage.color ?? '#2a1d24' }}>
        {anime.bannerImage && <Image src={anime.bannerImage} alt="" fill priority sizes="100vw" className="object-cover" />}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,17,0.35)_0%,rgba(14,14,17,0.6)_60%,#0e0e11_100%)]" />
        {anime.title.native && (
          <span aria-hidden="true" className="native-deco absolute right-6 top-[84px] hidden md:block xl:right-12">
            {anime.title.native.slice(0, 14)}
          </span>
        )}
      </section>
      {/* Soft accent glow bleeding out under the banner */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[200px] -z-0 h-[420px] opacity-25 blur-[90px]"
        style={{ background: 'radial-gradient(60% 50% at 30% 30%, var(--accent), transparent 70%)' }} />

      <div className="relative mx-auto -mt-[190px] flex max-w-[1800px] flex-col gap-10 px-4 md:px-8">
        {/* Title block */}
        <div className="flex flex-wrap items-end gap-6 md:gap-8">
          <ViewTransition name={`poster-${anime.id}`} share="morph">
            <div className="relative h-[234px] w-[165px] shrink-0 overflow-hidden rounded-panel border border-line-hover shadow-[0_20px_50px_rgba(0,0,0,0.6)] md:h-[312px] md:w-[220px]"
              style={{ background: anime.coverImage.color ?? '#4a3a5a' }}>
              <Image src={anime.coverImage.extraLarge} alt={title} fill priority sizes="220px" className="object-cover" />
            </div>
          </ViewTransition>
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5">
            {anime.status === 'RELEASING' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="status" />
                {next && (
                  <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
                    {A.nextEp(next.episode)}
                    <CountdownRing airingAt={next.airingAt} size={20} className="[&_strong]:text-[13px]" />
                    <span>· {formatDayDate(next.airingAt)}</span>
                  </span>
                )}
              </div>
            )}
            <h1 className="m-0 text-[30px] font-extrabold leading-[1.1] tracking-[-0.5px] md:text-[44px]">{title}</h1>
            {anime.title.romaji && anime.title.romaji !== title && (
              <div className="text-[15px] text-muted">{anime.title.romaji}</div>
            )}
            <div className="flex flex-wrap items-center gap-3.5 text-sm text-fg-2">
              {score !== '—' && <span className="inline-flex items-center gap-1 font-bold text-star"><StarIcon size={12} />{score}</span>}
              {season && <span>{season}</span>}
              <span>{[formatFormat(anime.format), total ? `${aired} / ${total} ep` : aired ? `${aired} ep` : null].filter(Boolean).join(' · ')}</span>
              {anime.duration && <span>{A.minutes(anime.duration)}</span>}
              {studio && <span>{studio}</span>}
            </div>
            {anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {anime.genres.map(g => <Chip key={g} tint={genreTint(g)} href={`/trending?genre=${encodeURIComponent(g)}`}>{g}</Chip>)}
              </div>
            )}
            <div className="mt-1 flex flex-wrap gap-2.5">
              <Link href={`/watch/${anime.id}?ep=${cta.ep}`}
                className="flex h-[50px] items-center gap-2.5 rounded-btn bg-accent px-[22px] text-[15px] font-bold text-white transition-colors hover:brightness-110">
                <PlayIcon size={16} />
                <span className="flex flex-col leading-[1.15]">
                  {cta.label}
                  {cta.sub && <span className="text-xs font-medium opacity-85">{cta.sub}</span>}
                </span>
              </Link>
              <WatchlistButton animeId={anime.id} animeTitle={title} coverImage={anime.coverImage.extraLarge} className="!h-[50px] !bg-surface-2" />
              <CopyLinkButton />
            </div>
          </div>
        </div>

        {/* Body + info */}
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-8">
            {desc && (
              <section className="flex flex-col gap-2.5">
                <h2 className="m-0 text-lg font-bold">{A.synopsis}</h2>
                <ClampText text={desc} lines={3} className="text-[15px] leading-[1.65] text-[#b4b4bd]" />
              </section>
            )}

            {episodes.length > 0
              ? <EpisodeGrid episodes={episodes} aired={aired} total={total} fallbackColor={anime.coverImage.color} />
              : <p className="m-0 text-sm text-muted">{A.unknownEpisodes}</p>}

            {related.length > 0 && (
              <section className="flex flex-col gap-3.5">
                <h2 className="m-0 text-lg font-bold">{A.related}</h2>
                <div className="scrollbar-hide flex gap-3.5 overflow-x-auto pb-1.5">
                  {related.map(r => {
                    const t = r.node.title.english ?? r.node.title.romaji;
                    const sub = [formatFormat(r.node.format) || titleCase(r.node.type), r.node.status ? formatStatus(r.node.status) : null].filter(Boolean).join(' · ');
                    const body = (
                      <>
                        <span className="relative h-[78px] w-14 shrink-0 overflow-hidden rounded-chip" style={{ background: r.node.coverImage.color ?? 'var(--surface-3)' }}>
                          <Image src={r.node.coverImage.medium} alt="" fill sizes="56px" className="object-cover" />
                        </span>
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="text-[11px] font-bold tracking-[0.5px] text-accent-fg">{r.relationType.replace(/_/g, ' ')}</span>
                          <span className="line-clamp-2 text-sm font-semibold">{t}</span>
                          <span className="text-xs text-muted">{sub}</span>
                        </span>
                      </>
                    );
                    const cls = 'flex shrink-0 basis-[300px] items-center gap-3 rounded-card border border-line bg-surface p-2.5';
                    return r.node.type === 'ANIME'
                      ? <Link key={`${r.relationType}-${r.node.id}`} href={`/anime/${r.node.id}`} className={`${cls} hover:border-line-hover`}>{body}</Link>
                      : <div key={`${r.relationType}-${r.node.id}`} className={cls}>{body}</div>;
                  })}
                </div>
              </section>
            )}
          </div>

          <aside className="flex w-full flex-[1_1_280px] flex-col gap-3.5 rounded-panel border border-line bg-surface p-5 text-sm md:max-w-[340px]">
            {info.map(i => (
              <div key={i.k} className="flex justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
                <span className="text-muted">{i.k}</span>
                <span className="text-right">{i.v}</span>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}

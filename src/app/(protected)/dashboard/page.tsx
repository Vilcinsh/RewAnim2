import { auth } from '@/lib/auth';
import {
  getTrending, getAiringSchedule, getAnimeByIds, getRecommendationsFor, getAnimeByGenres,
  airedEpisodes, displayTitle, franchiseKey, type AnimeMedia,
} from '@/lib/anilist';
import { getContinueWatching, getWatchlist, getUserTopGenres, getWatchedAnimeIds } from '@/lib/db-progress';
import { dayBounds, formatClock, nowUnix } from '@/lib/time';
import { strings } from '@/lib/strings';
import HomeHero, { type HeroSlide } from '@/components/home/HomeHero';
import ContinueWatching, { type ContinueMedia } from '@/components/home/ContinueWatching';
import SectionRow from '@/components/ui/SectionRow';
import AnimeCard from '@/components/AnimeCard';
import HoverPreview from '@/components/HoverPreview';

const H = strings.home;
const HERO_SLIDES = 8;

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const now = nowUnix();
  const [dayStart, dayEnd] = dayBounds(now);

  const continueItems = userId ? getContinueWatching(userId, 20) : [];
  const watchlistIds = new Set(userId ? getWatchlist(userId).map(w => w.animeId) : []);
  // "Because you watched" sources: the two most recently watched titles.
  const recSources = [...new Set(continueItems.map(c => c.animeId))].slice(0, 2);

  const [trending, today, continueMedia, recGroups] = await Promise.all([
    getTrending(1, 30),
    getAiringSchedule(dayStart, dayEnd),
    getAnimeByIds(continueItems.map(c => c.animeId)),
    getRecommendationsFor(recSources),
  ]);

  // ── Hero: newest episode from the watchlist first, then trending key art.
  const slides: HeroSlide[] = [];
  const airedToday = today.filter(s => s.airingAt <= now);
  const fromWatchlist = [...airedToday].reverse().find(s => watchlistIds.has(s.media.id) && s.media.bannerImage);
  if (fromWatchlist) {
    slides.push({ anime: fromWatchlist.media, badge: H.outToday(fromWatchlist.episode), note: H.fromWatchlist, watchEpisode: fromWatchlist.episode });
  }
  trending.forEach((a, i) => {
    if (slides.length >= HERO_SLIDES || !a.bannerImage || slides.some(s => s.anime.id === a.id)) return;
    const todayEp = airedToday.find(s => s.media.id === a.id);
    slides.push({
      anime: a,
      badge: todayEp ? H.outToday(todayEp.episode) : H.trendingRank(i + 1),
      watchEpisode: todayEp?.episode ?? 1,
    });
  });
  const heroId = slides[0]?.anime.id;

  // ── Trending row: one entry per franchise, hero title excluded.
  const seen = new Set<string>();
  const trendingRow = trending.filter(a => {
    if (a.id === heroId) return false;
    const k = franchiseKey(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 15);

  // ── Continue watching: banner art + aired counts for the cards.
  const media: Record<number, ContinueMedia> = {};
  for (const m of continueMedia) {
    media[m.id] = { banner: m.bannerImage, color: m.coverImage.color, aired: airedEpisodes(m), total: m.episodes };
  }

  // ── Because you watched X (AniList recommendations), genre picks as fallback.
  const titleById = new Map(continueMedia.map(m => [m.id, displayTitle(m)]));
  const watched = new Set(continueItems.map(c => c.animeId));
  const groups = recGroups
    .map(g => ({ src: titleById.get(g.sourceId) ?? '', items: g.items.filter(a => !watched.has(a.id)) }))
    .filter(g => g.src && g.items.length >= 4);

  let topPicks: AnimeMedia[] = [];
  if (!groups.length && userId) {
    try {
      const genres = getUserTopGenres(userId, 4);
      if (genres.length) topPicks = await getAnimeByGenres(genres, getWatchedAnimeIds(userId), 1, 20);
    } catch { /* row simply stays hidden */ }
  }

  return (
    <>
      {/* Full-bleed hero sits under the transparent header. */}
      <HomeHero slides={slides} />
      <div className={`relative mx-auto flex max-w-[1800px] flex-col gap-11 px-4 pb-24 md:px-8 lg:pb-16 ${slides.length ? 'mt-4' : ''}`}
        style={slides.length ? undefined : { paddingTop: 'calc(var(--header-h) + 24px)' }}>

        <ContinueWatching initialItems={continueItems} media={media} />

        {today.length > 0 && (
          <SectionRow title={H.newToday} meta={H.episodesCount(today.length)}
            leading={<span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />}
            viewAllHref="/airing" viewAllLabel={H.schedule} gap={14}>
            {today.map(s => (
              <div key={`${s.media.id}-${s.episode}`} className="w-[240px] min-w-0 shrink-0 snap-start sm:w-[260px]">
                <AnimeCard variant="compact" anime={s.media}
                  href={s.airingAt <= now ? `/watch/${s.media.id}?ep=${s.episode}` : `/anime/${s.media.id}`}
                  lines={[strings.episode.long(s.episode), `${formatClock(s.airingAt)}${s.airingAt <= now ? ` · ${H.aired}` : ''}`]} />
              </div>
            ))}
          </SectionRow>
        )}

        {trendingRow.length > 0 && (
          <SectionRow title={H.trending} viewAllHref="/trending" align="start">
            {trendingRow.map((a, i) => (
              <HoverPreview key={a.id} anime={a} className="shrink-0 snap-start" >
                <div className="w-[140px] min-w-0 sm:w-[180px]">
                  <AnimeCard anime={a} rank={i + 1} inList={watchlistIds.has(a.id)} sizes="180px" />
                </div>
              </HoverPreview>
            ))}
          </SectionRow>
        )}

        {groups.map(g => (
          <SectionRow key={g.src}
            title={<><span className="font-medium text-muted">{H.becauseYouWatched}</span>{g.src}</>}>
            {g.items.map(a => (
              <HoverPreview key={a.id} anime={a} className="shrink-0 snap-start">
                <div className="w-[140px] min-w-0 sm:w-[180px]">
                  <AnimeCard anime={a} inList={watchlistIds.has(a.id)} sizes="180px" />
                </div>
              </HoverPreview>
            ))}
          </SectionRow>
        ))}

        {topPicks.length > 0 && (
          <SectionRow title={H.topPicks}>
            {topPicks.map(a => (
              <HoverPreview key={a.id} anime={a} className="shrink-0 snap-start">
                <div className="w-[140px] min-w-0 sm:w-[180px]">
                  <AnimeCard anime={a} inList={watchlistIds.has(a.id)} sizes="180px" />
                </div>
              </HoverPreview>
            ))}
          </SectionRow>
        )}
      </div>
    </>
  );
}

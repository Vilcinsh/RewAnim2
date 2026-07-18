import { auth } from '@/lib/auth';
import { getTrending, getPopular, getCurrentlyAiring, getAnimeByGenres, getTopRated, getNewlyCompleted } from '@/lib/anilist';
import { getOthersWatching, getUserTopGenres, getWatchedAnimeIds } from '@/lib/db-progress';
import AnimeSliderRow from '@/components/AnimeSliderRow';
import SimpleSliderRow, { type SimpleItem } from '@/components/SimpleSliderRow';
import LandscapeSliderRow from '@/components/LandscapeSliderRow';
import HeroSlider from '@/components/HeroSlider';
import ContinueWatchingRow from '@/components/ContinueWatchingRow';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;

  const [trending, popular, airing, topRated, newlyCompleted] = await Promise.all([
    getTrending(1, 20),
    getPopular(1, 20),
    getCurrentlyAiring(1, 20),
    getTopRated(1, 20),
    getNewlyCompleted(1, 20),
  ]);

  let othersItems: SimpleItem[] = [];
  let recommendations = trending.slice(0, 15);
  if (userId) {
    const others = getOthersWatching(userId, 20);
    othersItems = others.map(o => ({
      animeId: o.animeId,
      animeTitle: o.animeTitle,
      coverImage: o.coverImage,
      badge: o.viewerCount > 1 ? `${o.viewerCount} viewers` : undefined,
    }));

    try {
      const topGenres = getUserTopGenres(userId, 4);
      const watchedIds = getWatchedAnimeIds(userId);
      if (topGenres.length > 0) {
        const recs = await getAnimeByGenres(topGenres, watchedIds, 1, 20);
        if (recs.length >= 5) recommendations = recs;
      }
    } catch { /* fallback to trending */ }
  }

  return (
    <div className="pt-14 pb-20 md:pb-10">
      <div className="px-4 pt-4">
        {/* Hero */}
        <div className="rounded-2xl overflow-hidden mb-8">
          <HeroSlider anime={trending} />
        </div>

        {/* Trending Now */}
        <LandscapeSliderRow
          title="Trending Now"
          anime={trending}
          seeAllHref="/trending"
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
              <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5 0.67z"/>
            </svg>
          }
        />

        {/* Continue Watching */}
        <ContinueWatchingRow />

        {/* Personalized + community rows */}
        <AnimeSliderRow title="Top Picks for You" anime={recommendations} />
        {othersItems.length > 0 && (
          <SimpleSliderRow title="Recently Watched by Others" items={othersItems} />
        )}
        <AnimeSliderRow title="Newly Completed" anime={newlyCompleted} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
          {/* New Releases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
                New Releases
              </h2>
              <a href="/airing" className="text-[12px] font-medium hover:underline" style={{ color: 'var(--red)' }}>View All</a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {airing.slice(0, 4).map(a => {
                const title = a.title.english ?? a.title.romaji;
                const imgSrc = a.bannerImage ?? a.coverImage.extraLarge;
                const ep = a.nextAiringEpisode?.episode ? a.nextAiringEpisode.episode - 1 : 1;
                const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : null;
                return (
                  <a key={a.id} href={`/anime/${a.id}`} className="group block">
                    <div className="relative rounded-xl overflow-hidden aspect-video">
                      <img src={imgSrc} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg,rgba(0,0,0,0.85) 0%,transparent 55%)' }} />
                      <div className="absolute top-1.5 left-1.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--red)', color: '#fff' }}>NEW</div>
                      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                        <h3 className="text-[10px] font-bold text-white line-clamp-1">{title}</h3>
                        <p className="text-[9px] mt-0.5 flex items-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          <span>Ep {ep} · Sub</span>
                          {score && <span className="text-yellow-400 ml-auto">★ {score}</span>}
                        </p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Top Rated */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Top Rated
              </h2>
              <a href="/popular" className="text-[12px] font-medium hover:underline" style={{ color: 'var(--red)' }}>View All</a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {topRated.slice(0, 4).map((a, i) => {
                const title = a.title.english ?? a.title.romaji;
                const imgSrc = a.bannerImage ?? a.coverImage.extraLarge;
                const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : null;
                return (
                  <a key={a.id} href={`/anime/${a.id}`} className="group block">
                    <div className="relative rounded-xl overflow-hidden aspect-video">
                      <img src={imgSrc} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg,rgba(0,0,0,0.85) 0%,transparent 55%)' }} />
                      <div className="absolute top-1.5 left-1.5 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(251,191,36,0.9)', color: '#000' }}>#{i + 1}</div>
                      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                        <h3 className="text-[10px] font-bold text-white line-clamp-1">{title}</h3>
                        <p className="text-[9px] mt-0.5 flex items-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          <span>{a.episodes ? `${a.episodes} ep` : 'TV'}</span>
                          {score && <span className="text-yellow-400 ml-auto">★ {score}</span>}
                        </p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

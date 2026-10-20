import Link from 'next/link';
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { getFilteredAnime, type AnimeFilters, type AnimeMedia } from '@/lib/anilist';
import { getWatchedAnimeIds, getWatchlist } from '@/lib/db-progress';
import { strings } from '@/lib/strings';
import { nowUnix } from '@/lib/time';
import AnimeCard from '@/components/AnimeCard';
import CatalogFilters from '@/components/CatalogFilters';
import EmptyState from '@/components/ui/EmptyState';

type Props = {
  searchParams: Promise<{
    q?: string;
    genre?: string;
    format?: string;
    status?: string;
    year?: string;
    season?: string;
    sort?: string;
    page?: string;
    hideWatched?: string;
  }>;
};

const C = strings.catalog;
const PER_PAGE = 42; // 7 columns × 6 rows
const MAX_PAGES = 8;

export default async function CatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const pages = Math.min(Math.max(Number(params.page) || 1, 1), MAX_PAGES);

  const filters: AnimeFilters = {
    search: params.q || undefined,
    genre: params.genre || undefined,
    format: params.format || undefined,
    status: params.status || undefined,
    year: params.year ? Number(params.year) : undefined,
    season: params.season || undefined,
    sort: params.sort || undefined,
  };

  // "Load more" re-renders pages 1..N (each page is cached individually).
  const results = await Promise.all(Array.from({ length: pages }, (_, i) => getFilteredAnime(filters, i + 1, PER_PAGE)));
  const seen = new Set<number>();
  let anime: AnimeMedia[] = results.flat().filter(a => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  const hasMore = results[results.length - 1].length === PER_PAGE && pages < MAX_PAGES;

  if (params.hideWatched === '1' && userId) {
    const watched = new Set(getWatchedAnimeIds(userId));
    anime = anime.filter(a => !watched.has(a.id));
  }
  const inList = new Set(userId ? getWatchlist(userId).map(w => w.animeId) : []);

  const moreParams = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  moreParams.set('page', String(pages + 1));
  const currentYear = new Date(nowUnix() * 1000).getFullYear();

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-[22px] px-4 pb-24 md:px-8 md:pb-16"
      style={{ paddingTop: 'calc(var(--header-h) + 32px)' }}>
      <Suspense>
        <CatalogFilters currentYear={currentYear} />
      </Suspense>

      {anime.length === 0 ? (
        <EmptyState title={C.noResults} description={C.noResultsHint} action={{ label: C.clearAll, href: '/trending' }} />
      ) : (
        <>
          <span className="-mt-2 text-sm text-muted">{C.showing(anime.length)}</span>
          <div className="grid grid-cols-2 gap-x-[18px] gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {anime.map((a, i) => (
              <AnimeCard key={a.id} anime={a} inList={inList.has(a.id)} priority={i < 7}
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 180px" />
            ))}
          </div>
          {hasMore && (
            <Link href={`/trending?${moreParams.toString()}`} scroll={false}
              className="flex h-12 items-center self-center rounded-btn border border-line-hover bg-surface-2 px-7 text-sm font-semibold text-fg transition-colors hover:border-fg-2">
              {C.loadMore}
            </Link>
          )}
        </>
      )}
    </div>
  );
}

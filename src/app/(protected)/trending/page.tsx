import { getFilteredAnime } from '@/lib/anilist';
import AnimeCard from '@/components/AnimeCard';
import CatalogFilters from '@/components/CatalogFilters';
import { Suspense } from 'react';

type Props = {
  searchParams: Promise<{
    q?: string;
    genre?: string;
    format?: string;
    status?: string;
    year?: string;
    season?: string;
    sort?: string;
  }>;
};

export default async function TrendingPage({ searchParams }: Props) {
  const params = await searchParams;

  const anime = await getFilteredAnime({
    search: params.q || undefined,
    genre: params.genre || undefined,
    format: params.format || undefined,
    status: params.status || undefined,
    year: params.year ? Number(params.year) : undefined,
    season: params.season || undefined,
    sort: params.sort || undefined,
  }, 1, 50);

  const hasFilters = Object.values(params).some(Boolean);

  return (
    <div className="container mx-auto px-4 pt-20 pb-8 max-w-7xl">
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6 border-l-[3px] border-[var(--primary)] pl-3">
        Catalog
      </h1>

      <Suspense>
        <CatalogFilters />
      </Suspense>

      {anime.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
          <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-sm">Nav rezultātu. Pamēģini citus filtrus.</p>
        </div>
      ) : (
        <>
          {hasFilters && (
            <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
              {anime.length} results
            </p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {anime.map(a => <AnimeCard key={a.id} anime={a} />)}
          </div>
        </>
      )}
    </div>
  );
}

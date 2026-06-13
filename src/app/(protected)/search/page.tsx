import { searchAnime } from '@/lib/anilist';
import AnimeCard from '@/components/AnimeCard';
import SearchInput from '@/components/SearchInput';

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const results = q && q.trim() ? await searchAnime(q.trim(), 1, 40) : [];

  return (
    <div className="container mx-auto px-4 pt-20 pb-8 max-w-7xl">
      <SearchInput initialValue={q ?? ''} />

      {q && q.trim() ? (
        <div className="mt-6">
          {results.length === 0 ? (
            <div className="text-center py-24 text-[var(--foreground)]/30">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <p className="text-lg font-medium">No results for &ldquo;{q}&rdquo;</p>
              <p className="text-sm mt-1 opacity-60">Try a different title or spelling</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest font-semibold mb-4">
                {results.length} results for &ldquo;{q}&rdquo;
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {results.map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-20 text-center text-[var(--foreground)]/25">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p className="text-lg">Start typing to search</p>
        </div>
      )}
    </div>
  );
}

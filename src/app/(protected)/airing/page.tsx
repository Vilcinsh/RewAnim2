import { getCurrentlyAiring } from '@/lib/anilist';
import AnimeCard from '@/components/AnimeCard';

export default async function AiringPage() {
  const anime = await getCurrentlyAiring(1, 50);
  return (
    <div className="container mx-auto px-4 pt-20 pb-8 max-w-7xl">
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6 border-l-[3px] border-[var(--primary)] pl-3">Airing</h1>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {anime.map((a) => <AnimeCard key={a.id} anime={a} />)}
      </div>
    </div>
  );
}

import AnimeCard from './AnimeCard';
import type { AnimeMedia } from '@/lib/anilist';
import Link from 'next/link';

type Props = {
  title: string;
  anime: AnimeMedia[];
  seeAllHref?: string;
};

export default function AnimeRow({ title, anime, seeAllHref }: Props) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-lg font-bold text-[var(--foreground)]">
          <span className="border-l-2 border-[var(--primary)] pl-3">{title}</span>
        </h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-sm text-[var(--foreground)]/50 hover:text-[var(--primary)] transition-colors">
            Skatīt visus →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {anime.map((a) => (
          <AnimeCard key={a.id} anime={a} />
        ))}
      </div>
    </section>
  );
}

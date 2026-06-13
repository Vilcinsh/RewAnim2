'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore, formatFormat } from '@/lib/anilist';

type Props = {
  anime: AnimeMedia;
};

export default function AnimeCard({ anime }: Props) {
  const title = anime.title.english ?? anime.title.romaji;
  const score = formatScore(anime.averageScore);
  const isAiring = anime.status === 'RELEASING';

  return (
    <Link href={`/anime/${anime.id}`} className="group block">
      {/* Image */}
      <div className="relative rounded-lg overflow-hidden aspect-[2/3] transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-2xl group-hover:shadow-black/80 group-hover:z-10">
        <Image
          src={anime.coverImage.large}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.08]"
        />

        {score !== '—' && (
          <div className="absolute top-1.5 left-1.5 bg-black/70 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10">
            ★ {score}
          </div>
        )}
        {isAiring && (
          <div className="absolute top-1.5 right-1.5 bg-[var(--primary)] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider z-10">
            On Air
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[8]" />
        <Link
          href={`/watch/${anime.id}?ep=1`}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-[9]"
        >
          <div className="w-12 h-12 bg-[var(--primary)] text-white rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Text below */}
      <div className="mt-2 px-0.5">
        <h3 className="text-[12px] font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">
          {title}
        </h3>
        <p className="text-[11px] text-[var(--foreground)]/40 mt-1">
          {[formatFormat(anime.format), anime.episodes ? `${anime.episodes} ep` : null].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  );
}

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore } from '@/lib/anilist';

type Props = {
  title: string;
  anime: AnimeMedia[];
  seeAllHref?: string;
  icon?: React.ReactNode;
};

const CARD_W = 235;
const CARD_H = 290;

function LandscapeCard({ anime, rank }: { anime: AnimeMedia; rank: number }) {
  const title = anime.title.english ?? anime.title.romaji;
  const score = formatScore(anime.averageScore);
  const imgSrc = anime.coverImage.extraLarge ?? anime.bannerImage;
  const isHot = rank === 1;

  return (
    <Link href={`/anime/${anime.id}`} className="group block shrink-0" style={{ width: CARD_W }}>
      <div className="relative rounded-xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:z-10"
        style={{ height: CARD_H }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(0,0,0,0.7), 0 0 20px rgba(229,9,20,0.25)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>

        <Image
          src={imgSrc}
          alt={title}
          fill
          quality={90}
          sizes="(max-width: 640px) 40vw, 160px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />

        {/* Bottom gradient */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />

        {/* HOT badge */}
        {isHot && (
          <div className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded z-10"
            style={{ background: 'var(--red)', color: '#fff' }}>
            HOT
          </div>
        )}

        {/* Hover play button */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-250 z-[8]" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-250 z-[9]">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-2xl" style={{ background: 'var(--red)' }}>
            <svg className="w-4 h-4 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 z-10">
          <h3 className="text-[11px] font-bold text-white line-clamp-2 leading-snug mb-1">{title}</h3>
          <div className="flex items-center justify-between">
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {anime.nextAiringEpisode
                ? `Ep ${anime.nextAiringEpisode.episode - 1}`
                : anime.episodes
                  ? `${anime.episodes} ep`
                  : 'TV'}
            </p>
            {score !== '—' && (
              <span className="text-[10px] font-bold text-yellow-400 flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {score}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LandscapeSliderRow({ title, anime, seeAllHref, icon }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const dragStart = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll); };
  }, [checkScroll]);

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' });
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft ?? 0 };
    setDragging(false);
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStart.current || !scrollRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    if (Math.abs(dx) > 4) setDragging(true);
  }, []);
  const onMouseUp = useCallback(() => {
    dragStart.current = null;
    setTimeout(() => setDragging(false), 0);
  }, []);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {seeAllHref && (
            <Link href={seeAllHref} className="text-sm font-medium hover:underline" style={{ color: 'var(--red)' }}>
              View All →
            </Link>
          )}
          <div className="flex gap-1">
            <button onClick={() => scroll('left')} disabled={!canLeft}
              className="w-7 h-7 rounded flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]/60 hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button onClick={() => scroll('right')} disabled={!canRight}
              className="w-7 h-7 rounded flex items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]/60 hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        {canLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-14 bg-gradient-to-r from-[var(--background)] to-transparent z-10 pointer-events-none" />
        )}
        <div className="absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-[var(--background)] to-transparent z-10 pointer-events-none" />

        <div ref={scrollRef} onScroll={checkScroll}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          className={`flex gap-3 overflow-x-auto scrollbar-hide pb-1 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          {anime.map((a, i) => <LandscapeCard key={a.id} anime={a} rank={i + 1} />)}
        </div>
      </div>
    </section>
  );
}

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

const CARD_W = 220;
const CARD_H = 124;

function LandscapeCard({ anime, rank }: { anime: AnimeMedia; rank: number }) {
  const title = anime.title.english ?? anime.title.romaji;
  const score = formatScore(anime.averageScore);
  const imgSrc = anime.bannerImage ?? anime.coverImage.extraLarge;
  const isHot = rank === 1;

  return (
    <Link href={`/anime/${anime.id}`} className="group block shrink-0" style={{ width: CARD_W }}>
      <div className="relative rounded-xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:z-10"
        style={{ height: CARD_H }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.7), 0 0 20px rgba(229,9,20,0.25)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
        <Image src={imgSrc} alt={title} fill quality={90} sizes={`(min-resolution: 2dppx) ${CARD_W * 2}px, ${CARD_W}px`}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />

        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.1) 100%)' }} />

        {/* HOT badge */}
        {isHot && (
          <div className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded z-10"
            style={{ background: 'var(--red)', color: '#fff' }}>
            HOT
          </div>
        )}

        {/* Options button */}
        <button className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={e => e.preventDefault()}
          style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)' }}>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
        </button>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2 z-10 flex items-end justify-between">
          <div className="min-w-0 flex-1 mr-2">
            <h3 className="text-[11px] font-bold text-white line-clamp-1 leading-snug">{title}</h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {anime.nextAiringEpisode
                ? `Ep ${anime.nextAiringEpisode.episode - 1} · Sub`
                : anime.episodes
                  ? `Ep ${anime.episodes} · Sub`
                  : 'Sub'}
            </p>
          </div>
          {score !== '—' && (
            <span className="text-[10px] font-bold text-yellow-400 shrink-0 flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {score}
            </span>
          )}
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
    <section className="mb-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {seeAllHref && (
            <Link href={seeAllHref} className="text-[12px] font-medium" style={{ color: 'var(--red)' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
              View All
            </Link>
          )}
          {/* Next arrow */}
          <button onClick={() => scrollRef.current?.scrollBy({ left: 500, behavior: 'smooth' })}
            disabled={!canRight}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        {canLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, var(--bg) 0%, transparent 100%)' }} />
        )}
        <div className="absolute right-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(270deg, var(--bg) 0%, transparent 100%)' }} />

        <div ref={scrollRef} onScroll={checkScroll}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          className={`flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          {anime.map((a, i) => <LandscapeCard key={a.id} anime={a} rank={i + 1} />)}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type SimpleItem = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  badge?: string;
};

type Props = {
  title: string;
  items: SimpleItem[];
  seeAllHref?: string;
};

const CARD_W = 185;
const CARD_H = 300;

export default function SimpleSliderRow({ title, items, seeAllHref }: Props) {
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
  }, [checkScroll, items]);

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

  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--foreground)] border-l-[3px] border-[var(--primary)] pl-3">{title}</h2>
        <div className="flex items-center gap-3">
          {seeAllHref && (
            <Link href={seeAllHref} className="text-sm text-[var(--primary)] hover:underline font-medium">View All →</Link>
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
          <div className="absolute left-0 top-0 bottom-2 w-14 bg-gradient-to-r from-[var(--background)] to-transparent z-10 pointer-events-none" />
        )}
        <div className="absolute right-0 top-0 bottom-2 w-14 bg-gradient-to-l from-[var(--background)] to-transparent z-10 pointer-events-none" />

        <div ref={scrollRef} onScroll={checkScroll}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          className={`flex gap-3 overflow-x-auto scrollbar-hide pb-2 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          {items.map(item => (
            <Link key={item.animeId} href={`/anime/${item.animeId}`} className="group block shrink-0" style={{ width: CARD_W }}>
              <div className="relative rounded-lg overflow-hidden transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-2xl group-hover:shadow-black/80 group-hover:z-10" style={{ height: CARD_H }}>
                {item.coverImage ? (
                  <Image src={item.coverImage} alt={item.animeTitle} fill sizes={`${CARD_W}px`}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.08]" />
                ) : (
                  <div className="w-full h-full bg-[var(--surface-2)] flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                )}
                {item.badge && (
                  <div className="absolute top-1.5 right-1.5 bg-[var(--primary)] text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider z-10">
                    {item.badge}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[8]" />
                <Link href={`/watch/${item.animeId}?ep=1`} onClick={e => e.stopPropagation()}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-[9]">
                  <div className="w-12 h-12 bg-[var(--primary)] text-white rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </Link>
              </div>
              <div className="mt-2 px-0.5">
                <h3 className="text-[12px] font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">{item.animeTitle}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

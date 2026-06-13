'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type ContinueItem = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  episode: number;
  watchedSeconds: number;
  durationSeconds: number;
  updatedAt: string;
};

const CARD_W = 235;
const CARD_H = 300;

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ContinueWatchingRow() {
  const [items, setItems] = useState<ContinueItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const dragStart = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    fetch('/api/user/progress?type=continue')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.items)) setItems(data.items); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

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

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            <h2 className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>Continue Watching</h2>
          </div>
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

      <div className="relative">
        {canLeft && (
          <div className="absolute left-0 top-0 bottom-2 w-14 bg-gradient-to-r from-[var(--background)] to-transparent z-10 pointer-events-none" />
        )}
        <div className="absolute right-0 top-0 bottom-2 w-14 bg-gradient-to-l from-[var(--background)] to-transparent z-10 pointer-events-none" />

        <div ref={scrollRef} onScroll={checkScroll}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          className={`flex gap-3 overflow-x-auto scrollbar-hide pb-2 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          {items.map(item => {
            const pct = item.durationSeconds > 0
              ? Math.min(100, Math.round((item.watchedSeconds / item.durationSeconds) * 100))
              : 0;
            return (
              <Link key={`${item.animeId}-${item.episode}`} href={`/watch/${item.animeId}?ep=${item.episode}`}
                className="group block shrink-0" style={{ width: CARD_W }}>
                <div className="relative rounded-xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:z-10" style={{ height: CARD_H }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(229,9,20,0.3)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                  {item.coverImage ? (
                    <Image src={item.coverImage} alt={item.animeTitle} fill sizes="235px" quality={90}
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
                  ) : (
                    <div className="w-full h-full bg-[var(--surface-2)]" />
                  )}


                  <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
                    Ep {item.episode}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 z-10">
                    <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                  </div>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[8]" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-[9]">
                    <div className="w-12 h-12 bg-[var(--primary)] text-white rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                      <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                </div>

                <div className="mt-2 px-0.5">
                  <h3 className="text-[12px] font-semibold text-[var(--foreground)] line-clamp-1 leading-snug">{item.animeTitle}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-[var(--foreground)]/40">{fmt(item.watchedSeconds)}</span>
                    <span className="text-[10px] text-[var(--primary)] font-bold">{pct}%</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

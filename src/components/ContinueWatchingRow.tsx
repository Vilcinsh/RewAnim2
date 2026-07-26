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

const CARD_W = 280;

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
        <h2 className="text-[15px] font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--red)' }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          Continue Watching
        </h2>
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
          <div className="absolute left-0 top-0 bottom-0 w-14 bg-gradient-to-r from-[var(--background)] to-transparent z-10 pointer-events-none" />
        )}
        <div className="absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-[var(--background)] to-transparent z-10 pointer-events-none" />

        <div ref={scrollRef} onScroll={checkScroll}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          className={`flex gap-3 overflow-x-auto scrollbar-hide pb-1 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
          {items.map(item => {
            const pct = item.durationSeconds > 0
              ? Math.min(100, Math.round((item.watchedSeconds / item.durationSeconds) * 100))
              : 0;
            const remaining = item.durationSeconds > 0
              ? Math.max(0, item.durationSeconds - item.watchedSeconds)
              : 0;

            return (
              <Link
                key={`${item.animeId}-${item.episode}`}
                href={`/watch/${item.animeId}?ep=${item.episode}`}
                className="group block shrink-0"
                style={{ width: CARD_W }}
              >
                {/* Thumbnail — 16:9 */}
                <div className="relative rounded-xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:z-10"
                  style={{ aspectRatio: '16/9' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(0,0,0,0.7), 0 0 20px rgba(229,9,20,0.25)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>

                  {item.coverImage ? (
                    <Image
                      src={item.coverImage}
                      alt={item.animeTitle}
                      fill
                      sizes="280px"
                      quality={90}
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="w-full h-full" style={{ background: 'var(--surface-2)' }} />
                  )}

                  {/* Gradient overlays */}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />

                  {/* Ep badge */}
                  <div className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded z-10"
                    style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)' }}>
                    Ep {item.episode}
                  </div>

                  {/* Remaining time */}
                  {remaining > 0 && (
                    <div className="absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded z-10"
                      style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>
                      -{fmt(remaining)}
                    </div>
                  )}

                  {/* Hover overlay + play */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-250 z-[8]" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-250 z-[9]">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-110"
                      style={{ background: 'var(--red)' }}>
                      <svg className="w-5 h-5 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 z-10">
                    <div className="h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: 'var(--red)' }} />
                    </div>
                  </div>
                </div>

                {/* Info below */}
                <div className="mt-2 px-0.5">
                  <h3 className="text-[12px] font-semibold line-clamp-1 leading-snug" style={{ color: 'var(--text)' }}>
                    {item.animeTitle}
                  </h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Episode {item.episode}</span>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--red)' }}>{pct}%</span>
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

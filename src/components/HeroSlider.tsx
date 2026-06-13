'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore } from '@/lib/anilist';

type Props = { anime: AnimeMedia[] };

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function HeroSlider({ anime }: Props) {
  const slides = anime.filter(a => a.bannerImage).slice(0, 8);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const next = useCallback(() => setIdx(i => (i + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setIdx(i => (i - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(next, 7000);
    return () => clearInterval(t);
  }, [paused, next, slides.length]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (paused || slides.length <= 1) { bar.style.transition = 'none'; bar.style.width = '0%'; return; }
    bar.style.transition = 'none'; bar.style.width = '0%';
    bar.getBoundingClientRect();
    bar.style.transition = 'width 7000ms linear'; bar.style.width = '100%';
  }, [idx, paused, slides.length]);

  if (!slides.length) return null;
  const s = slides[idx];
  const title = s.title.english ?? s.title.romaji;
  const desc = s.description ? stripHtml(s.description).slice(0, 150) + '…' : null;

  return (
    <div className="relative w-full overflow-hidden bg-black select-none rounded-2xl" style={{ height: 460 }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

      {/* Images */}
      {slides.map((slide, i) => (
        <div key={slide.id} className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0, zIndex: 1 }}>
          <Image src={slide.bannerImage!} alt="" fill quality={95} className="object-cover" priority={i === 0} sizes="100vw" />
        </div>
      ))}

      {/* Gradient — heavy left fade, subtle bottom */}
      <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(90deg,rgba(9,9,11,.95) 0%,rgba(9,9,11,.65) 45%,rgba(9,9,11,.1) 100%)' }} />
      <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(0deg,rgba(9,9,11,.8) 0%,transparent 35%)' }} />

      {/* Arrows */}
      {['prev','next'].map(dir => (
        <button key={dir} onClick={dir === 'prev' ? prev : next}
          className="absolute top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ [dir === 'prev' ? 'left' : 'right']: 12, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.85)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.45)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d={dir === 'prev' ? 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z' : 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'}/>
          </svg>
        </button>
      ))}

      {/* Content */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end px-10 pb-9 max-w-xl">
        {/* REW ORIGINAL badge */}
        <div className="mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded"
            style={{ background: 'var(--red)', color: '#fff' }}>
            REW ORIGINAL
          </span>
        </div>

        <h2 className="text-4xl font-black text-white leading-tight line-clamp-2 mb-2 drop-shadow-xl uppercase tracking-tight">
          {title}
        </h2>

        {/* Score + episodes */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          {s.averageScore ? (
            <span className="flex items-center gap-1 font-bold text-yellow-400">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {formatScore(s.averageScore)}
            </span>
          ) : null}
          {s.episodes && <span style={{ color: 'rgba(255,255,255,0.45)' }}>{s.episodes} eps</span>}
          {s.seasonYear && <span style={{ color: 'rgba(255,255,255,0.45)' }}>{s.seasonYear}</span>}
        </div>

        {desc && (
          <p className="text-sm leading-relaxed mb-5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {desc}
          </p>
        )}

        {/* Buttons + dots */}
        <div className="flex items-center gap-3">
          <Link href={`/watch/${s.id}?ep=1`}
            className="flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{ background: 'var(--red)', color: '#fff', boxShadow: '0 4px 20px rgba(229,9,20,0.4)' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Watch Now
          </Link>

          <Link href={`/anime/${s.id}`}
            className="flex items-center gap-2 font-medium px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.18)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add to Watchlist
          </Link>

          <div className="flex items-center gap-1.5 ml-1">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} className="rounded-full transition-all duration-300"
                style={{ width: i === idx ? 20 : 5, height: 5, background: i === idx ? 'var(--red)' : 'rgba(255,255,255,0.25)' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 h-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div ref={barRef} className="h-full" style={{ width: '0%', background: 'rgba(229,9,20,0.6)' }} />
      </div>
    </div>
  );
}

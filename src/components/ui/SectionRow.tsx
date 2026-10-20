'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { strings } from '@/lib/strings';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

type Props = {
  title: React.ReactNode;
  /** Small muted text after the title ("14 episodes"). */
  meta?: React.ReactNode;
  /** Element before the title (status dot, icon). */
  leading?: React.ReactNode;
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Gap between items in px. */
  gap?: number;
  /** Cross-axis alignment of items (hover-expanded cards need flex-start). */
  align?: 'start' | 'stretch';
  children: React.ReactNode;
  className?: string;
};

export default function SectionRow({
  title, meta, leading, viewAllHref, viewAllLabel = strings.actions.viewAll,
  gap = 16, align = 'stretch', children, className = '',
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', update); };
  }, [update]);

  function scrollBy(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  }

  const arrow = 'flex h-11 w-11 items-center justify-center rounded-full text-fg-2 transition-colors hover:text-fg disabled:opacity-30 disabled:hover:text-fg-2';

  return (
    <section className={`flex flex-col gap-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {leading}
          <h2 className="m-0 truncate text-xl font-bold">{title}</h2>
          {meta && <span className="shrink-0 text-[13px] text-muted">{meta}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewAllHref && (
            <Link href={viewAllHref} className="mr-1 text-sm text-accent-fg hover:text-fg">{viewAllLabel} →</Link>
          )}
          <div className="hidden items-center pointer-fine:flex">
            <button type="button" className={arrow} onClick={() => scrollBy(-1)} disabled={!canPrev} aria-label={strings.actions.scrollLeft}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-surface-2"><ChevronLeftIcon size={16} /></span>
            </button>
            <button type="button" className={arrow} onClick={() => scrollBy(1)} disabled={!canNext} aria-label={strings.actions.scrollRight}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-surface-2"><ChevronRightIcon size={16} /></span>
            </button>
          </div>
        </div>
      </div>
      <div ref={scroller}
        className={`scrollbar-hide flex snap-x snap-proximity overflow-x-auto pb-1.5 ${align === 'start' ? 'items-start' : 'items-stretch'}`}
        style={{ gap }}>
        {children}
      </div>
    </section>
  );
}

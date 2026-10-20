'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore, episodeLabel, displayTitle } from '@/lib/anilist';
import { strings } from '@/lib/strings';
import Chip from '@/components/ui/Chip';
import Badge from '@/components/ui/Badge';
import WatchlistButton from '@/components/WatchlistButton';
import { StarIcon } from '@/components/ui/icons';

const OPEN_DELAY = 400;
const CLOSE_GRACE = 120;
const PAD = 10;
const INFO_W = 270;

type Props = {
  anime: AnimeMedia;
  children: React.ReactNode;
  /** Href for the Watch button; defaults to episode 1. */
  watchHref?: string;
  className?: string;
};

type Pos = { left: number; top: number; posterW: number; flip: boolean };

function stripHtml(s: string | null): string {
  return (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Wraps a poster card and, on desktop mouse hover held for 400 ms, expands it
 * sideways: the poster stays exactly where the card is and an info panel
 * slides out to its right (or left near the viewport edge).
 * Rendered in a portal so horizontal scrollers don't clip it.
 * Touch / keyboard users get the plain card — the preview is an enhancement.
 */
export default function HoverPreview({ anime, children, watchHref, className = '' }: Props) {
  const anchor = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pos, setPos] = useState<Pos | null>(null);

  const close = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    setPos(null);
  }, []);

  function scheduleOpen(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    clearTimeout(closeTimer.current);
    if (pos) return;
    openTimer.current = setTimeout(() => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.width + INFO_W + PAD * 3;
      const flip = r.left - PAD + total > window.innerWidth - 16;
      // Offset by padding + 1px border so the panel's poster lands exactly on the card's.
      const left = flip ? r.right + PAD + 1 - total : r.left - PAD - 1;
      const posterH = r.width * 1.5;
      const top = Math.min(Math.max(r.top - PAD - 1, 72), window.innerHeight - posterH - PAD * 2 - 16);
      setPos({ left, top, posterW: r.width, flip });
    }, OPEN_DELAY);
  }

  function scheduleClose() {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPos(null), CLOSE_GRACE);
  }

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, { passive: true, capture: true });
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos, close]);

  useEffect(() => () => { clearTimeout(openTimer.current); clearTimeout(closeTimer.current); }, []);

  const title = displayTitle(anime);
  const score = formatScore(anime.averageScore);
  const synopsis = stripHtml(anime.description);

  return (
    // The card's own hover zoom is disabled here: the preview poster sits on top of it unscaled.
    <div ref={anchor} data-no-tilt className={`[&_img]:!scale-100 ${className}`} onPointerEnter={scheduleOpen} onPointerLeave={scheduleClose}>
      {children}
      {pos && createPortal(
        <div
          className={`fixed z-[60] flex gap-[14px] rounded-panel border border-[#34343f] bg-[#1b1b22] shadow-[0_18px_40px_rgba(0,0,0,0.55)] ${
            pos.flip ? 'animate-expand-left flex-row-reverse' : 'animate-expand-right'}`}
          style={{
            left: pos.left, top: pos.top, padding: PAD,
            ['--clip' as string]: `${INFO_W + PAD + 14}px`,
          }}
          onPointerEnter={() => clearTimeout(closeTimer.current)}
          onPointerLeave={scheduleClose}
        >
          {/* Same poster file as the card (already cached), same size and place. */}
          <Link href={`/anime/${anime.id}`} tabIndex={-1} className="relative block shrink-0 overflow-hidden rounded-card"
            style={{ width: pos.posterW, height: pos.posterW * 1.5, background: anime.coverImage.color ?? 'var(--surface-3)' }}>
            {/* Plain <img>, eager + sync decode: the file is already in cache from the card,
                so it paints in the same frame instead of flashing empty first. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={anime.coverImage.large} alt="" loading="eager" decoding="sync" className="absolute inset-0 h-full w-full object-cover" />
            {score !== '—' && <Badge variant="score" className="absolute bottom-2 right-2">{score}</Badge>}
          </Link>
          <div className={`flex flex-col gap-2.5 py-1 ${pos.flip ? 'animate-info-in-left' : 'animate-info-in-right'}`} style={{ width: INFO_W }}>
            <Link href={`/anime/${anime.id}`} className="line-clamp-3 text-base font-bold leading-tight hover:text-white">{title}</Link>
            <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-fg-2">
              {score !== '—' && <span className="inline-flex items-center gap-1 font-bold text-star"><StarIcon size={11} />{score}</span>}
              <span className="inline-flex items-center gap-1.5">
                {anime.status === 'RELEASING' && <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />}
                {episodeLabel(anime)}
              </span>
            </div>
            {anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {anime.genres.slice(0, 3).map(g => <Chip key={g} size="sm">{g}</Chip>)}
              </div>
            )}
            {synopsis && <p className="m-0 line-clamp-4 text-[13px] leading-normal text-[#b4b4bd]">{synopsis}</p>}
            <div className="mt-auto flex gap-2 pt-1">
              <Link href={watchHref ?? `/watch/${anime.id}?ep=1`}
                className="flex h-10 flex-1 items-center justify-center rounded-chip bg-accent text-sm font-bold text-white hover:brightness-110">
                {strings.actions.watch}
              </Link>
              <WatchlistButton variant="icon" animeId={anime.id} animeTitle={title} coverImage={anime.coverImage.large} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

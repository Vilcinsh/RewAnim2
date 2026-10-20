'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore, formatFormat, episodeLabel, displayTitle } from '@/lib/anilist';
import { strings } from '@/lib/strings';
import Chip from '@/components/ui/Chip';
import WatchlistButton from '@/components/WatchlistButton';
import { PlayIcon, StarIcon, VolumeOffIcon, VolumeOnIcon } from '@/components/ui/icons';

export type HeroSlide = {
  anime: AnimeMedia;
  /** Accent pill, e.g. "EP 3 OUT TODAY". */
  badge: string;
  /** Muted text after the badge, e.g. "From your watchlist". */
  note?: string;
  watchEpisode: number;
};

/** Every slide gets the same time, trailer or not, so the progress line never jumps. */
const SLIDE_MS = 10000;
/** Short delay before mounting the trailer, so quickly skipped slides don't load YouTube. */
const TRAILER_MOUNT_MS = 600;
/** Give up on a trailer that hasn't started playing by then; key art stays. */
const TRAILER_GIVE_UP_MS = 8000;
/** YouTube overlays its own play/pause controls for the first seconds of playback
 *  even with controls=0; keep the video hidden until they've faded. */
const TRAILER_REVEAL_DELAY_MS = 3200;
const YT_ORIGIN = 'https://www.youtube-nocookie.com';
const H = strings.home;

function stripHtml(s: string | null): string {
  return (s ?? '').replace(/<[^>]*>/g, '').replace(/&[^;\s]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Trailers only where they're cheap and wanted: desktop pointer, no reduced motion/data, not a TV. */
function trailerAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  if (/SMART-TV|SmartTV|Tizen|Web0S|WebOS|AndroidTV|BRAVIA|CrKey|AFT/i.test(navigator.userAgent)) return false;
  return true;
}

export default function HomeHero({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [trailerOn, setTrailerOn] = useState(false);
  const [muted, setMuted] = useState(true);

  const onTrailerStart = useCallback(() => setTrailerOn(true), []);

  const goTo = useCallback((i: number) => {
    setIdx(i);
    setTrailerOn(false);
    setMuted(true);
  }, []);

  useEffect(() => {
    // Never auto-advance away from a trailer the user unmuted.
    if (paused || slides.length <= 1 || !muted) return;
    const t = setTimeout(() => goTo((idx + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, paused, muted, slides.length, goTo]);

  if (!slides.length) return null;
  const slide = slides[idx];
  const a = slide.anime;
  const title = displayTitle(a);
  const score = formatScore(a.averageScore);
  const season = a.season && a.seasonYear ? `${a.season[0]}${a.season.slice(1).toLowerCase()} ${a.seasonYear}` : a.seasonYear;
  const synopsis = stripHtml(a.description);
  const next = slides[(idx + 1) % slides.length];

  return (
    <section
      aria-roledescription="carousel" aria-label={H.featured}
      className="relative h-[clamp(440px,62svh,620px)] w-full overflow-hidden bg-[#1a1a21]"
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
    >
      <HeroBackground key={a.id} anime={a} muted={muted} onTrailerStart={onTrailerStart} />
      {/* Warm the next slide's key art so the switch doesn't flash. */}
      {next && next !== slide && (
        <Image src={next.anime.bannerImage ?? next.anime.coverImage.extraLarge} alt="" fill sizes="100vw"
          className="pointer-events-none invisible" aria-hidden="true" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(14,14,17,0.95)_0%,rgba(14,14,17,0.7)_35%,rgba(14,14,17,0)_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[rgba(14,14,17,0.7)] to-transparent" />

      <div className="relative mx-auto flex h-full max-w-[1800px] items-end gap-8 px-4 pb-10 md:px-8 md:pb-12">
        <div className="flex max-w-[640px] flex-col gap-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-accent px-2.5 py-[5px] text-xs font-bold text-white">{slide.badge}</span>
            {slide.note && <span className="text-[13px] text-fg-2">{slide.note}</span>}
          </div>
          <h1 className="m-0 line-clamp-3 text-[30px] font-extrabold leading-[1.08] tracking-[-0.5px] md:text-[42px]">
            <Link href={`/anime/${a.id}`} className="hover:text-white">{title}</Link>
          </h1>
          <div className="flex flex-wrap items-center gap-3.5 text-sm text-fg-2">
            {score !== '—' && <span className="inline-flex items-center gap-1 font-bold text-star"><StarIcon size={12} />{score}</span>}
            {season && <span>{season}</span>}
            <span>{[formatFormat(a.format), episodeLabel(a)].filter(Boolean).join(' · ')}</span>
            {a.studios?.nodes?.[0] && <span className="hidden sm:inline">{a.studios.nodes[0].name}</span>}
          </div>
          {a.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {a.genres.slice(0, 3).map(g => <Chip key={g}>{g}</Chip>)}
            </div>
          )}
          {synopsis && <p className="m-0 line-clamp-2 text-[15px] leading-[1.55] text-[#c4c4cc] md:line-clamp-3">{synopsis}</p>}
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            <Link href={`/watch/${a.id}?ep=${slide.watchEpisode}`}
              className="flex h-12 items-center gap-2 rounded-btn bg-accent px-[22px] text-[15px] font-bold text-white transition-colors hover:bg-[#f0202c]">
              <PlayIcon size={16} />{H.watchEp(slide.watchEpisode)}
            </Link>
            <WatchlistButton animeId={a.id} animeTitle={title} coverImage={a.coverImage.large} />
            {trailerOn && (
              <button type="button" onClick={() => setMuted(m => !m)} aria-label={muted ? H.unmute : H.mute} aria-pressed={!muted}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-line-hover bg-white/[0.08] text-fg transition-colors hover:border-fg-2">
                {muted ? <VolumeOffIcon size={18} /> : <VolumeOnIcon size={18} />}
              </button>
            )}
          </div>
        </div>

        {slides.length > 1 && (
          <div className="ml-auto hidden max-w-[52%] items-end gap-2.5 overflow-x-auto pb-1 scrollbar-hide lg:flex">
            {slides.map((s, i) => {
              const active = i === idx;
              const t = displayTitle(s.anime);
              return (
                <button key={s.anime.id} type="button" onClick={() => goTo(i)}
                  aria-label={H.slide(t)} aria-current={active ? 'true' : undefined}
                  className={`relative h-[68px] shrink-0 overflow-hidden rounded-chip text-left transition-[width,border-color,opacity] duration-300 ${
                    active ? 'w-[132px] border-2 border-accent' : 'w-[100px] border border-white/[0.14] opacity-75 hover:opacity-100'
                  }`}
                  style={{ background: s.anime.coverImage.color ?? '#2a2a33' }}>
                  <Image src={s.anime.bannerImage ?? s.anime.coverImage.large} alt="" fill sizes="132px" className="object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 to-black/10" />
                  <span className="absolute inset-x-1.5 bottom-1.5 line-clamp-2 text-[11px] font-semibold leading-tight text-fg">{t}</span>
                  {active && !paused && muted && (
                    <span key={idx} aria-hidden="true" className="absolute bottom-0 left-0 h-[3px] bg-accent"
                      style={{ animation: `hero-progress ${SLIDE_MS}ms linear forwards` }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function HeroBackground({ anime, muted, onTrailerStart }: {
  anime: AnimeMedia; muted: boolean; onTrailerStart: () => void;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [mountTrailer, setMountTrailer] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ytId = anime.trailer?.site === 'youtube' ? anime.trailer.id : null;

  useEffect(() => {
    if (!ytId || !trailerAllowed()) return;
    const t = setTimeout(() => setMountTrailer(true), TRAILER_MOUNT_MS);
    return () => clearTimeout(t);
  }, [ytId]);

  // Reveal the video only once YouTube reports it is actually playing —
  // before that it shows its own black frame / title card.
  useEffect(() => {
    if (!mountTrailer) return;
    let done = false;
    function onMessage(e: MessageEvent) {
      if (e.origin !== YT_ORIGIN || e.source !== iframe.current?.contentWindow || done) return;
      let data: { event?: string; info?: number | { playerState?: number } } | null = null;
      try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      const state = data?.event === 'onStateChange' ? data.info
        : data?.event === 'infoDelivery' && typeof data.info === 'object' ? data.info?.playerState : undefined;
      if (state === 1 && !started) {
        started = true;
        clearTimeout(giveUp);
        reveal = setTimeout(() => { setPlaying(true); onTrailerStart(); }, TRAILER_REVEAL_DELAY_MS);
      } else if (state === 0) {
        // Ended (no loop — a restart would bring the overlay back): fade back to key art.
        done = true;
        clearTimeout(reveal);
        setPlaying(false);
      }
    }
    let started = false;
    let reveal: ReturnType<typeof setTimeout> | undefined;
    window.addEventListener('message', onMessage);
    const giveUp = setTimeout(() => { if (!started) done = true; }, TRAILER_GIVE_UP_MS);
    return () => { window.removeEventListener('message', onMessage); clearTimeout(giveUp); clearTimeout(reveal); };
  }, [mountTrailer, onTrailerStart]);

  useEffect(() => {
    if (!playing) return;
    iframe.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: [] }), YT_ORIGIN);
  }, [muted, playing]);

  const art = anime.bannerImage ?? anime.coverImage.extraLarge;

  return (
    <div className="absolute inset-0 [container-type:size]" style={{ background: anime.coverImage.color ?? '#1a1a21' }}>
      <Image src={art} alt="" fill priority sizes="100vw"
        className={`object-cover object-[70%_center] transition-opacity duration-1000 ${playing ? 'opacity-0' : 'opacity-100'}`} />
      {mountTrailer && ytId && (
        <iframe
          ref={iframe}
          title={`${displayTitle(anime)} trailer`}
          tabIndex={-1}
          aria-hidden="true"
          allow="autoplay; encrypted-media"
          src={`${YT_ORIGIN}/embed/${ytId}?autoplay=1&mute=1&controls=0&start=10&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
          onLoad={() => {
            // Subscribe to player events (state changes come back via postMessage).
            iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT_ORIGIN);
          }}
          className={`pointer-events-none absolute left-1/2 top-1/2 aspect-video -translate-x-1/2 -translate-y-1/2 scale-[1.2] border-0 transition-opacity duration-1000 ${playing ? 'opacity-100' : 'opacity-0'}`}
          style={{ width: 'max(100%, 177.78cqh)' }}
        />
      )}
    </div>
  );
}

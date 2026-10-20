import Link from 'next/link';
import Image from 'next/image';
import type { AnimeMedia } from '@/lib/anilist';
import { formatScore, episodeLabel, displayTitle } from '@/lib/anilist';
import { strings } from '@/lib/strings';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { XIcon } from '@/components/ui/icons';

type PosterProps = {
  variant?: 'default';
  anime: AnimeMedia;
  /** Show the red "in watchlist" check in the top-right corner. */
  inList?: boolean;
  /** Overrides the meta line under the title (defaults to episodeLabel). */
  meta?: string;
  /** Small rank square in the top-left (trending rows); airing then shows as a dot in the meta line. */
  rank?: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

type RankedProps = {
  variant: 'ranked';
  anime: AnimeMedia;
  rank: number;
  className?: string;
};

type CompactProps = {
  variant: 'compact';
  anime: AnimeMedia;
  /** Up to two lines under the title ("Episode 3", "14:30 · SUB"). */
  lines?: string[];
  href?: string;
  className?: string;
};

type EpisodeProps = {
  variant: 'episode';
  href: string;
  title: string;
  subtitle?: string;
  /** Episode still; falls back to `fallbackImage`, then a flat color. */
  image?: string | null;
  fallbackImage?: string | null;
  fallbackColor?: string | null;
  /** Top-left badge, e.g. "EP 3" or "Next · Ep 15". */
  badge?: string;
  /** Bottom-right tag, e.g. "24:00", "NEW", "14 min left". */
  tag?: string;
  /** 0–1 watched progress. */
  progress?: number;
  current?: boolean;
  future?: boolean;
  onRemove?: () => void;
  className?: string;
};

export type AnimeCardProps = PosterProps | RankedProps | CompactProps | EpisodeProps;

export default function AnimeCard(props: AnimeCardProps) {
  switch (props.variant) {
    case 'ranked': return <RankedCard {...props} />;
    case 'compact': return <CompactCard {...props} />;
    case 'episode': return <EpisodeCard {...props} />;
    default: return <PosterCard {...props} />;
  }
}

function Poster({ anime, sizes, priority, children }: {
  anime: AnimeMedia; sizes: string; priority?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-card"
      style={{ background: anime.coverImage.color ?? 'var(--surface-3)' }}>
      {/* AniList already serves poster-sized files; skipping the optimizer avoids
          the /_next/image proxy stalling long grids (lower rows never loading). */}
      <Image src={anime.coverImage.large} alt="" fill sizes={sizes} priority={priority} unoptimized
        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      {children}
    </div>
  );
}

function PosterCard({ anime, inList, meta, rank, priority, className = '',
  sizes = '(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 180px' }: PosterProps) {
  const title = displayTitle(anime);
  const score = formatScore(anime.averageScore);
  return (
    <Link href={`/anime/${anime.id}`} className={`group flex min-w-0 flex-col gap-2 ${className}`}>
      <Poster anime={anime} sizes={sizes} priority={priority}>
        {rank != null
          ? <span className="absolute left-2 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-chip bg-scrim text-sm font-extrabold">{rank}</span>
          : anime.status === 'RELEASING' && <Badge variant="airing" className="absolute left-2 top-2" />}
        {inList && <Badge variant="inList" className="absolute right-2 top-2" />}
        {score !== '—' && <Badge variant="score" className="absolute bottom-2 right-2">{score}</Badge>}
      </Poster>
      <span className="line-clamp-2 text-sm font-semibold leading-[1.3] group-hover:text-white">{title}</span>
      <span className="-mt-1 flex items-center gap-1.5 text-xs text-muted">
        {rank != null && anime.status === 'RELEASING' && <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />}
        {meta ?? episodeLabel(anime)}
      </span>
    </Link>
  );
}

function RankedCard({ anime, rank, className = '' }: RankedProps) {
  const title = displayTitle(anime);
  const score = formatScore(anime.averageScore);
  return (
    <Link href={`/anime/${anime.id}`} className={`group flex min-w-0 items-end ${className}`}
      aria-label={`#${rank} ${title}`}>
      <span aria-hidden="true"
        className="rank-numeral -mr-4 select-none text-[120px] font-extrabold leading-[0.8] tracking-[-0.06em] tabular-nums">
        {rank}
      </span>
      <span className="relative flex w-[150px] shrink-0 flex-col gap-2">
        <Poster anime={anime} sizes="150px">
          {score !== '—' && <Badge variant="score" className="absolute bottom-2 right-2">{score}</Badge>}
        </Poster>
        <span className="line-clamp-2 text-sm font-semibold leading-[1.3]">{title}</span>
        <span className="-mt-1 flex items-center gap-1.5 text-xs text-muted">
          {anime.status === 'RELEASING' && <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />}
          {episodeLabel(anime)}
        </span>
      </span>
    </Link>
  );
}

function CompactCard({ anime, lines, href, className = '' }: CompactProps) {
  const title = displayTitle(anime);
  const [first, second] = lines ?? [episodeLabel(anime)];
  return (
    <Link href={href ?? `/anime/${anime.id}`}
      className={`flex min-w-0 items-center gap-3 rounded-card border border-line bg-surface p-2.5 transition-colors hover:border-line-hover ${className}`}>
      <span className="relative h-[78px] w-14 shrink-0 overflow-hidden rounded-chip"
        style={{ background: anime.coverImage.color ?? 'var(--surface-3)' }}>
        <Image src={anime.coverImage.medium} alt="" fill sizes="56px" className="object-cover" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-semibold">{title}</span>
        {first && <span className="text-[13px] text-[#d4d4da]">{first}</span>}
        {second && <span className="text-xs text-muted">{second}</span>}
      </span>
    </Link>
  );
}

function EpisodeCard({
  href, title, subtitle, image, fallbackImage, fallbackColor, badge, tag, progress,
  current, future, onRemove, className = '',
}: EpisodeProps) {
  const src = image ?? fallbackImage;
  const body = (
    <>
      <span className={`relative block aspect-video overflow-hidden rounded-btn ${
        current ? 'border-2 border-accent' : 'border border-line'
      }`} style={{ background: future ? '#1b1b21' : fallbackColor ?? 'var(--surface-3)' }}>
        {src && !future && (
          // Episode stills come from many hosts; skip the optimizer.
          <Image src={src} alt="" fill unoptimized sizes="300px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        )}
        {badge && <Badge variant="label" className="absolute left-2 top-2 font-bold">{badge}</Badge>}
        {tag && <Badge variant="label" className="absolute bottom-2.5 right-2 font-normal text-[#e4e4e8]">{tag}</Badge>}
        {progress != null && progress > 0 && (
          <span className="absolute inset-x-0 bottom-0"><ProgressBar value={progress} /></span>
        )}
      </span>
      <span className="truncate text-sm font-semibold">{title}</span>
    </>
  );
  return (
    <div className={`group relative flex min-w-0 flex-col gap-2 ${future ? 'opacity-55' : ''} ${className}`}>
      {/* Future episodes aren't playable — no link. */}
      {future
        ? <div className="flex flex-col gap-2">{body}</div>
        : <Link href={href} className="flex flex-col gap-2">{body}</Link>}
      {subtitle && <span className="-mt-1 text-xs text-muted">{subtitle}</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={strings.actions.removeTitle(title)}
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-fg transition-colors hover:bg-black/85">
            <XIcon size={14} strokeWidth={2.5} />
          </span>
        </button>
      )}
    </div>
  );
}

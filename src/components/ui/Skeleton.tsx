type Props = { className?: string; style?: React.CSSProperties };

/** Shimmering placeholder block. Size it with classes. */
export default function Skeleton({ className = '', style }: Props) {
  return <div className={`skeleton rounded-card ${className}`} style={style} aria-hidden="true" />;
}

/** 2:3 poster + two text lines, matching AnimeCard default. */
export function PosterSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="h-3.5 w-4/5 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
  );
}

/** 16:9 thumbnail + text, matching AnimeCard episode variant. */
export function EpisodeSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-3.5 w-3/4 rounded" />
      <Skeleton className="h-3 w-1/3 rounded" />
    </div>
  );
}

/** Row placeholder: heading + n posters. */
export function SectionRowSkeleton({ count = 7, itemWidth = 180 }: { count?: number; itemWidth?: number }) {
  return (
    <section className="flex flex-col gap-3.5" aria-busy="true">
      <Skeleton className="h-5 w-48 rounded" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{ flex: `0 0 ${itemWidth}px` }}><PosterSkeleton /></div>
        ))}
      </div>
    </section>
  );
}

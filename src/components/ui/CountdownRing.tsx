'use client';

import { useNow } from '@/lib/use-now';
import { formatCountdown, strings } from '@/lib/strings';

type Props = {
  /** Unix seconds of the next airing (AniList nextAiringEpisode.airingAt). */
  airingAt: number;
  /** Length of one full ring; weekly shows by default. */
  periodSeconds?: number;
  size?: number;
  color?: string;
  /** Show the "6d 21h" text next to the ring. */
  showText?: boolean;
  className?: string;
};

export default function CountdownRing({
  airingAt, periodSeconds = 7 * 86400, size = 40, color, showText = true, className = '',
}: Props) {
  const now = useNow(30);
  const remaining = now == null ? null : airingAt - now;
  const progress = remaining == null ? 0 : 1 - Math.min(Math.max(remaining / periodSeconds, 0), 1);
  const text = remaining == null ? '—' : formatCountdown(remaining);

  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} role="timer" aria-label={strings.time.countdownLabel(text)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={color ?? 'var(--accent)'} strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      {showText && <strong className="text-sm font-semibold tabular-nums text-fg">{text}</strong>}
    </span>
  );
}

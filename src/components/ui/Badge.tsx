import { strings } from '@/lib/strings';
import { CheckIcon, StarIcon } from './icons';

type Variant = 'airing' | 'newEp' | 'inList' | 'score' | 'label' | 'status';

type Props = {
  variant: Variant;
  /** Text for `score` / `label` / `status`. */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Small overlays and labels used on posters and headers.
 * - airing: green dot + AIRING on a dark scrim (poster corner)
 * - newEp: solid accent "NEW EP"
 * - inList: accent square with a check (poster corner)
 * - score: ★ 7.5 on a scrim
 * - label: neutral text on a scrim ("EP 3", "24:00")
 * - status: green AIRING pill for page headers
 */
export default function Badge({ variant, children, className = '' }: Props) {
  switch (variant) {
    case 'airing':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-md bg-scrim px-[7px] py-1 text-[11px] font-bold leading-none ${className}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          {children ?? strings.badge.airing}
        </span>
      );
    case 'newEp':
      return (
        <span className={`inline-flex items-center rounded-md bg-accent px-2 py-1 text-[11px] font-extrabold leading-none text-white ${className}`}>
          {children ?? strings.badge.newEp}
        </span>
      );
    case 'inList':
      return (
        <span role="img" aria-label={strings.badge.inWatchlist}
          className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-md bg-accent text-white ${className}`}>
          <CheckIcon size={12} strokeWidth={3} />
        </span>
      );
    case 'score':
      return (
        <span className={`inline-flex items-center gap-1 rounded-md bg-scrim px-[7px] py-[3px] text-xs font-bold text-star ${className}`}>
          <StarIcon size={11} />{children}
        </span>
      );
    case 'status':
      return (
        <span className={`inline-flex items-center rounded-md bg-[#0f2a1a] px-2.5 py-[5px] text-xs font-bold text-success ${className}`}>
          {children ?? strings.badge.airing}
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center rounded-md bg-scrim px-2 py-[3px] text-xs font-semibold text-fg ${className}`}>
          {children}
        </span>
      );
  }
}

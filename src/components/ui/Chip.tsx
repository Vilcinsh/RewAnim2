import Link from 'next/link';
import { XIcon } from './icons';

type Props = {
  children: React.ReactNode;
  /** Selected/filter-on state (accent-soft fill). */
  active?: boolean;
  /** Optional per-genre tint (any CSS color); used for the border and a faint fill. */
  tint?: string;
  size?: 'sm' | 'md';
  href?: string;
  onClick?: () => void;
  /** Renders a removable chip with a trailing × (active filters). */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

export default function Chip({ children, active, tint, size = 'md', href, onClick, onRemove, removeLabel, className = '' }: Props) {
  const base = `inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors ${
    size === 'sm' ? 'px-2 py-[3px] text-[11px]' : 'px-2.5 py-[5px] text-xs'
  } ${active
    ? 'border-accent-line bg-accent-soft text-accent-fg'
    : 'border-line-hover text-[#d4d4da]'
  } ${className}`;
  const style = tint && !active
    ? { borderColor: `color-mix(in srgb, ${tint} 55%, transparent)`, background: `color-mix(in srgb, ${tint} 12%, transparent)` }
    : undefined;

  if (onRemove) {
    return (
      <button type="button" onClick={onRemove} aria-label={removeLabel}
        className={`${base} h-8 pointer-coarse:h-11 px-2.5 text-[13px] hover:border-accent`} style={style}>
        {children}<XIcon size={12} strokeWidth={2.5} />
      </button>
    );
  }
  if (href) {
    return <Link href={href} className={`${base} hover:border-line-hover hover:text-fg`} style={style}>{children}</Link>;
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active}
        className={`${base} pointer-coarse:min-h-11 hover:text-fg`} style={style}>
        {children}
      </button>
    );
  }
  return <span className={base} style={style}>{children}</span>;
}

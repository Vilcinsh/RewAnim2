type Props = {
  /** 0–1 */
  value: number;
  /** Track height in px. */
  height?: number;
  /** Overrides the accent color (e.g. per-anime color). */
  color?: string;
  rounded?: boolean;
  /** Accessible name; omit when the bar is purely decorative next to a text label. */
  label?: string;
  className?: string;
};

export default function ProgressBar({ value, height = 4, color, rounded = false, label, className = '' }: Props) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const radius = rounded ? height / 2 : 0;
  return (
    <div
      className={`w-full overflow-hidden bg-white/15 ${className}`}
      style={{ height, borderRadius: radius }}
      {...(label
        ? { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }
        : { 'aria-hidden': true })}
    >
      <div className="h-full bg-accent" style={{ width: `${pct}%`, borderRadius: radius, ...(color ? { background: color } : null) }} />
    </div>
  );
}

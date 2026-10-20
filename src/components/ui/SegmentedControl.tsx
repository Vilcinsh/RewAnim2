'use client';

type Option<T extends string> = { value: T; label: React.ReactNode };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Audio". */
  label: string;
  /** `accent` fills the selected segment red (Audio); `neutral` uses surface-3 (Grid/List, Quality). */
  tone?: 'neutral' | 'accent';
  className?: string;
};

export default function SegmentedControl<T extends string>({
  options, value, onChange, label, tone = 'neutral', className = '',
}: Props<T>) {
  return (
    <div role="group" aria-label={label}
      className={`inline-flex gap-1 rounded-btn border border-line bg-surface p-1 ${className}`}>
      {options.map(opt => {
        const selected = opt.value === value;
        return (
          <button key={opt.value} type="button" aria-pressed={selected} onClick={() => onChange(opt.value)}
            className={`h-9 pointer-coarse:h-11 rounded-[7px] px-3.5 text-[13px] transition-colors ${
              selected
                ? tone === 'accent' ? 'bg-accent font-bold text-white' : 'bg-[#2a2a33] font-semibold text-fg'
                : 'text-fg-2 hover:text-fg'
            }`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

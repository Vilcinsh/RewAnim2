import Link from 'next/link';
import { strings } from '@/lib/strings';

type Props = {
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
};

export default function EmptyState({ title = strings.empty.defaultTitle, description, icon, action, className = '' }: Props) {
  const btn = 'inline-flex h-11 items-center rounded-btn border border-line-hover bg-surface-2 px-5 text-sm font-semibold text-fg hover:border-fg-2';
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-line-strong px-6 py-14 text-center ${className}`}>
      {icon && <div className="text-muted" aria-hidden="true">{icon}</div>}
      <h3 className="m-0 text-base font-bold text-fg">{title}</h3>
      {description && <p className="m-0 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && (action.href
        ? <Link href={action.href} className={`${btn} mt-1`}>{action.label}</Link>
        : <button type="button" onClick={action.onClick} className={`${btn} mt-1`}>{action.label}</button>)}
    </div>
  );
}

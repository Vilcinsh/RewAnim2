'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_LINKS } from '@/components/Header';
import { strings } from '@/lib/strings';

const ICONS: Record<string, React.ReactNode> = {
  '/dashboard': <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />,
  '/trending': <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  '/airing': <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  '/profile?tab=watchlist': <path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" />,
  '/profile': <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
};

const ITEMS = [
  ...NAV_LINKS,
  { href: '/profile', label: strings.nav.profile, match: (p: string, tab: string | null) => (p === '/profile' && !!tab && tab !== 'watchlist') || p === '/stats' },
];

export default function MobileNav() {
  const pathname = usePathname();
  const tab = useSearchParams().get('tab');

  return (
    <nav aria-label={strings.nav.main}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-[rgba(14,14,17,0.92)] backdrop-blur-[16px] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex h-16 items-stretch">
        {ITEMS.map(item => {
          const active = item.match(pathname, tab);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                active ? 'text-accent-fg' : 'text-muted hover:text-fg'
              }`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[item.href]}
              </svg>
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
              {active && <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-accent" aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

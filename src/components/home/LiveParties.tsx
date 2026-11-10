'use client';

import { useEffect, useState } from 'react';
import { strings } from '@/lib/strings';
import { formatClockTime } from '@/lib/party-format';
import type { PartyListing } from '@/lib/party-shared';
import SectionRow from '@/components/ui/SectionRow';
import AnimeCard from '@/components/AnimeCard';

const P = strings.party;
const POLL_MS = 15_000;

// Open watch parties anyone can hop into — no invite link needed. Rendered
// with the server's list, then kept fresh while the tab is visible.
export default function LiveParties({ initial }: { initial: PartyListing[] }) {
  const [parties, setParties] = useState(initial);

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/party', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!stopped && Array.isArray(data.parties)) setParties(data.parties);
      } catch { /* keep the last list */ }
    }
    const iv = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  if (!parties.length) return null;

  return (
    <SectionRow title={P.liveTitle} meta={P.liveMeta(parties.length)}
      leading={<span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />}>
      {parties.map(p => (
        <div key={p.id} className="w-[260px] min-w-0 shrink-0 snap-start sm:w-[300px]">
          <AnimeCard variant="episode"
            href={`/watch/${p.animeId}?ep=${p.ep}&party=${encodeURIComponent(p.id)}`}
            title={p.title}
            subtitle={P.liveSubtitle(p.hostName, p.watching)}
            image={p.image} fallbackColor={p.color}
            badge={`${strings.episode.short(p.ep)} · ${p.lang.toUpperCase()}`}
            tag={`${p.playing ? P.liveTag : P.pausedTag} · ${formatClockTime(p.position)}`} />
        </div>
      ))}
    </SectionRow>
  );
}

'use client';

import { strings } from '@/lib/strings';
import type { WatchParty } from './useWatchParty';

const P = strings.party;

type Props = {
  party: WatchParty;
  needsGesture: boolean;
  onResume: () => void;
};

// Drawn inside the video player so reactions and "waiting for…" stay
// visible in fullscreen. Never catches clicks except its own button.
export default function PartyOverlay({ party, needsGesture, onResume }: Props) {
  const { state, status, reactions, isHost } = party;

  let pill: string | null = null;
  if (status === 'connecting') pill = P.connecting;
  else if (status === 'reconnecting') pill = P.reconnecting;
  else if (state) {
    if (state.waitingFor.length) pill = P.waitingFor(state.waitingFor);
    else if (!state.hostOnline && !isHost) pill = P.hostOffline;
    else if (!state.intentPlaying && !isHost) pill = P.pausedByHost;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {pill && (
        <div role="status" className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-[var(--primary)]" aria-hidden="true" />
          {pill}
        </div>
      )}

      {needsGesture && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button type="button" onClick={e => { e.stopPropagation(); onResume(); }}
            className="pointer-events-auto rounded-full border border-white/20 bg-black/75 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[var(--primary)]">
            ▶ {P.tapToJoin}
          </button>
        </div>
      )}

      {reactions.map(r => (
        <div key={r.id} className="animate-party-float absolute bottom-20 flex flex-col items-center"
          style={{ right: `${r.x}%` }}>
          <span className="text-4xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{r.emoji}</span>
          <span className="mt-0.5 rounded bg-black/60 px-1.5 text-[11px] text-white/90">{r.name}</span>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { strings } from '@/lib/strings';
import { PARTY_REACTIONS } from '@/lib/party-shared';
import ReactionButton from './ReactionButton';
import type { WatchParty } from './useWatchParty';

const P = strings.party;

type Props = {
  party: WatchParty;
  needsGesture: boolean;
  onResume: () => void;
  /** The player's own controls are showing (mouse moved / paused). */
  controlsVisible: boolean;
  /** This viewer isn't on the host's exact source, so timestamps won't line up. */
  sourceMismatch?: boolean;
};

// Drawn inside the video player so reactions, the emoji picker and
// "waiting for…" stay visible in fullscreen. Only its own buttons catch clicks.
export default function PartyOverlay({ party, needsGesture, onResume, controlsVisible, sourceMismatch }: Props) {
  const { state, status, reactions, isHost, send } = party;
  const [pickerOpen, setPickerOpen] = useState(false);

  function react(emoji: string) {
    void send({ type: 'react', emoji });
  }

  // 1–9 fire the first nine reactions — handy for spamming in fullscreen.
  useEffect(() => {
    if (status !== 'live') return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      const emoji = PARTY_REACTIONS[n - 1];
      if (emoji) void send({ type: 'react', emoji });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, send]);

  let pill: string | null = null;
  if (status === 'connecting') pill = P.connecting;
  else if (status === 'reconnecting') pill = P.reconnecting;
  else if (state) {
    if (state.waitingFor.length) pill = P.waitingFor(state.waitingFor);
    else if (!state.hostOnline && !isHost) pill = P.hostOffline;
    else if (sourceMismatch) pill = P.sourceMismatch;
    else if (!state.intentPlaying && !isHost) pill = P.pausedByHost;
  }

  const showPicker = status === 'live' && (controlsVisible || pickerOpen);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {pill && (
        <div role="status" className="absolute left-4 top-4 flex max-w-[calc(100%-32px)] items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden="true" />
          <span className="truncate">{pill}</span>
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
        <div key={r.id} className="animate-party-float absolute bottom-24 flex flex-col items-center"
          style={{ right: `${r.x}%`, '--drift': `${r.drift}px` } as React.CSSProperties}>
          <span className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" style={{ fontSize: `${2.25 * r.scale}rem`, lineHeight: 1 }}>{r.emoji}</span>
          <span className="mt-0.5 rounded bg-black/60 px-1.5 text-[11px] text-white/90">{r.name}</span>
        </div>
      ))}

      {showPicker && (
        <div data-no-video-toggle className="pointer-events-auto absolute bottom-[92px] right-3 flex flex-col items-end gap-2">
          {pickerOpen && (
            <div role="group" aria-label={P.reactions} title={P.reactHint}
              className="grid grid-cols-6 gap-0.5 rounded-xl border border-white/15 bg-black/75 p-1.5 backdrop-blur-sm">
              {PARTY_REACTIONS.map(e => (
                <ReactionButton key={e} emoji={e} label={P.react(e)} onReact={react}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 hover:bg-white/10 active:scale-95" />
              ))}
            </div>
          )}
          <button type="button" onClick={() => setPickerOpen(o => !o)} aria-expanded={pickerOpen} aria-label={P.reactions}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl text-white backdrop-blur-sm transition-colors ${
              pickerOpen ? 'border-[var(--primary)] bg-[var(--primary)]/30' : 'border-white/15 bg-black/70 hover:bg-black/85'
            }`}>
            {pickerOpen ? '×' : '😂'}
          </button>
        </div>
      )}
    </div>
  );
}

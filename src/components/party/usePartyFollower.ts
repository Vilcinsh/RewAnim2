'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyState } from '@/lib/party';
import type { PlayerHandle } from '@/components/player/VideoPlayer';
import { expectedPosition } from './useWatchParty';

const TICK_MS = 400;
/** Further off than this: jump. */
const HARD_SYNC_S = 1.5;
/** Between this and HARD_SYNC_S: quietly speed up / slow down to catch up. */
const SOFT_SYNC_S = 0.3;
const NUDGE = 0.05;
/** A brief stall shorter than this doesn't pause the whole room. */
const STALL_GRACE_MS = 800;
/** After we jump, give the (possibly slow, proxied) stream this long to land before jumping again. */
const SEEK_SETTLE_MS = 8000;

// The <video> is an external DOM object, not React state — mutate it via
// plain helpers so the compiler doesn't treat it as a frozen hook value.
function setTime(v: HTMLVideoElement, t: number) { v.currentTime = t; }
function setRate(v: HTMLVideoElement, r: number) { if (v.playbackRate !== r) v.playbackRate = r; }

type Opts = {
  enabled: boolean;
  playerRef: React.RefObject<PlayerHandle | null>;
  stateRef: React.RefObject<PartyState | null>;
  offsetRef: React.RefObject<number>;
  /** Changes whenever the shared state changes, so we react immediately. */
  stateVersion: unknown;
  onBuffering: (value: boolean) => void;
};

// Makes the local <video> follow the room's shared playhead. Runs for the
// host too: the host's own clicks update the room first (optimistically),
// and this loop then simply agrees with them — so "everyone waits for the
// slowest viewer" pauses the host exactly like everyone else.
export function usePartyFollower({ enabled, playerRef, stateRef, offsetRef, stateVersion, onBuffering }: Opts) {
  const [needsGesture, setNeedsGesture] = useState(false);
  const playPendingRef = useRef(false);
  const bufferingRef = useRef<boolean | null>(null);
  const stallSinceRef = useRef<number | null>(null);
  const seekAtRef = useRef(0);
  const onBufferingRef = useRef(onBuffering);
  useEffect(() => { onBufferingRef.current = onBuffering; }, [onBuffering]);

  const tick = useCallback(() => {
    const s = stateRef.current;
    const handle = playerRef.current;
    const v = handle?.video ?? null;
    if (!enabled || !s) return;

    // Only count as "buffering" when the room wants to play — otherwise a
    // paused viewer without data would hold everyone up forever. A seek is
    // reported at once; a short mid-playback stall (common on proxied EN
    // streams) only after STALL_GRACE_MS, so it doesn't stop-start everyone.
    const now = Date.now();
    const stalled = s.intentPlaying && (!v || v.readyState < 3 || v.seeking);
    if (stalled) stallSinceRef.current ??= now;
    else stallSinceRef.current = null;
    const buffering = stalled && (!!v?.seeking || now - (stallSinceRef.current ?? now) >= STALL_GRACE_MS);
    if (buffering !== bufferingRef.current) {
      bufferingRef.current = buffering;
      onBufferingRef.current(buffering);
    }

    if (!v || !handle || v.readyState < 1) return;

    const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
    const target = Math.min(expectedPosition(s, offsetRef.current), Math.max(0, dur - 0.3));
    const diff = v.currentTime - target;
    const atEnd = v.ended || target >= dur - 0.35;
    // Our last jump hasn't produced playable data yet — jumping again now
    // would just restart the load and chase the target forever.
    const landing = (v.seeking || v.readyState < 3) && now - seekAtRef.current < SEEK_SETTLE_MS;
    const jump = (t: number) => { setTime(v, t); seekAtRef.current = now; };

    if (s.playing && !atEnd) {
      if (landing) {
        setRate(v, 1);
      } else if (!v.seeking && Math.abs(diff) > HARD_SYNC_S) {
        jump(target);
        setRate(v, 1);
      } else if (Math.abs(diff) > SOFT_SYNC_S) {
        setRate(v, diff > 0 ? 1 - NUDGE : 1 + NUDGE);
      } else {
        setRate(v, 1);
      }
      if (v.paused && !playPendingRef.current) {
        playPendingRef.current = true;
        handle.play()
          .then(ok => setNeedsGesture(!ok))
          .finally(() => { playPendingRef.current = false; });
      }
    } else {
      setRate(v, 1);
      if (!v.paused) v.pause();
      if (!landing && !v.seeking && !atEnd && Math.abs(diff) > 0.5) jump(target);
    }
  }, [enabled, playerRef, stateRef, offsetRef]);

  useEffect(() => {
    if (!enabled) {
      bufferingRef.current = null;
      stallSinceRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when leaving a party
      setNeedsGesture(false);
      return;
    }
    const iv = setInterval(tick, TICK_MS);
    return () => clearInterval(iv);
  }, [enabled, tick]);

  useEffect(() => { tick(); }, [stateVersion, tick]);

  /** Called from a real click, which lets the browser allow playback. */
  const resume = useCallback(() => {
    const handle = playerRef.current;
    if (!handle) return;
    if (stateRef.current?.playing) handle.play().then(ok => setNeedsGesture(!ok));
    else setNeedsGesture(false);
  }, [playerRef, stateRef]);

  return { needsGesture, resume };
}

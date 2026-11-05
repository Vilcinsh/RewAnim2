'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, PartyAction, PartyState } from '@/lib/party';

export type PartyStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'closed' | 'missing';
export type FloatingReaction = { id: string; emoji: string; name: string; x: number };

const REACTION_MS = 2600;
/** Host ignores echoes this long after its own action, so a stale broadcast can't yank it back. */
const HOST_ECHO_GRACE_MS = 400;

/** Where the shared playhead should be right now, in this browser's clock. */
export function expectedPosition(s: PartyState, offsetMs: number) {
  if (!s.playing) return s.position;
  return s.position + Math.max(0, Date.now() + offsetMs - s.at) / 1000;
}

export function useWatchParty(partyId: string | null) {
  const [state, setState] = useState<PartyState | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [status, setStatus] = useState<PartyStatus>('idle');

  const stateRef = useRef<PartyState | null>(null);
  // Server clock minus ours. Network latency only ever makes a sample look
  // smaller than the truth, so the largest recent sample is the best guess.
  const offsetRef = useRef(0);
  const samplesRef = useRef<number[]>([]);
  const pendingControlsRef = useRef(0);
  const lastControlRef = useRef(0);
  const meRef = useRef<string | null>(null);

  const sample = useCallback((serverNow: unknown) => {
    if (typeof serverNow !== 'number') return;
    const s = samplesRef.current;
    s.push(serverNow - Date.now());
    if (s.length > 12) s.shift();
    offsetRef.current = Math.max(...s);
  }, []);

  const applyState = useCallback((next: PartyState) => {
    const isHost = meRef.current === next.hostId;
    const prev = stateRef.current;
    const busy = pendingControlsRef.current > 0 || Date.now() - lastControlRef.current < HOST_ECHO_GRACE_MS;
    // Keep the host's own optimistic playhead while its action is in flight;
    // everything else (members, source, waiting list) still updates.
    const merged = isHost && busy && prev
      ? { ...next, intentPlaying: prev.intentPlaying, playing: prev.playing && next.waitingFor.length === 0, position: prev.position, at: prev.at }
      : next;
    stateRef.current = merged;
    setState(merged);
  }, []);

  useEffect(() => {
    if (!partyId) {
      stateRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when leaving a party
      setState(null);
      setChat([]);
      setStatus('idle');
      return;
    }

    setStatus('connecting');
    const es = new EventSource(`/api/party/${encodeURIComponent(partyId)}/events`);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let ended = false;

    es.addEventListener('init', e => {
      const d = JSON.parse((e as MessageEvent).data);
      sample(d.now);
      meRef.current = d.you;
      setMe(d.you);
      setChat(d.chat ?? []);
      applyState(d.state);
      setStatus('live');
    });
    es.addEventListener('state', e => {
      const d = JSON.parse((e as MessageEvent).data);
      sample(d.now);
      applyState(d.state);
    });
    es.addEventListener('chat', e => {
      const msg = JSON.parse((e as MessageEvent).data) as ChatMessage;
      setChat(c => [...c.slice(-99), msg]);
    });
    es.addEventListener('react', e => {
      const d = JSON.parse((e as MessageEvent).data);
      const r: FloatingReaction = { id: d.id, emoji: d.emoji, name: d.name, x: 8 + Math.random() * 20 };
      setReactions(list => [...list.slice(-20), r]);
      const t = setTimeout(() => {
        timers.delete(t);
        setReactions(list => list.filter(x => x.id !== r.id));
      }, REACTION_MS);
      timers.add(t);
    });
    es.addEventListener('closed', () => {
      ended = true;
      es.close();
      setStatus('closed');
    });
    es.onerror = () => {
      if (ended) return;
      // A 404 (room gone, e.g. after a server restart) closes the source for
      // good; a dropped connection leaves it retrying on its own.
      if (es.readyState === EventSource.CLOSED) setStatus('missing');
      else setStatus('reconnecting');
    };

    return () => {
      es.close();
      timers.forEach(clearTimeout);
    };
  }, [partyId, sample, applyState]);

  const send = useCallback(async (action: PartyAction) => {
    if (!partyId) return false;
    try {
      const res = await fetch(`/api/party/${encodeURIComponent(partyId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [partyId]);

  /** Host play/pause/seek: applied locally right away, then sent. */
  const control = useCallback((playing: boolean, position: number) => {
    const prev = stateRef.current;
    if (prev) {
      const next = {
        ...prev,
        intentPlaying: playing,
        playing: playing && prev.waitingFor.length === 0,
        position,
        at: Date.now() + offsetRef.current,
      };
      stateRef.current = next;
      setState(next);
    }
    pendingControlsRef.current += 1;
    lastControlRef.current = Date.now();
    send({ type: 'control', playing, position }).finally(() => {
      pendingControlsRef.current -= 1;
      lastControlRef.current = Date.now();
    });
  }, [send]);

  const isHost = !!state && !!me && state.hostId === me;

  return { state, stateRef, offsetRef, chat, reactions, me, status, isHost, send, control };
}

export type WatchParty = ReturnType<typeof useWatchParty>;

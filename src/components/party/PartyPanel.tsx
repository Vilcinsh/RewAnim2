'use client';

import { useEffect, useRef, useState } from 'react';
import { strings } from '@/lib/strings';
import { PARTY_REACTIONS } from '@/lib/party-shared';
import { CheckIcon, LinkIcon, SpinnerIcon } from '@/components/ui/icons';
import type { WatchParty } from './useWatchParty';

const P = strings.party;

type Props = {
  partyId: string | null;
  party: WatchParty;
  inviteUrl: string;
  starting: boolean;
  startError: string | null;
  onStart: () => void;
  onLeave: () => void;
  onEnd: () => void;
};

const btn = 'flex h-9 items-center gap-1.5 rounded-btn px-3.5 text-[13px] font-semibold transition-colors pointer-coarse:h-11 disabled:opacity-50';

export default function PartyPanel({ partyId, party, inviteUrl, starting, startError, onStart, onLeave, onEnd }: Props) {
  const { state, status, chat, me, isHost, send } = party;
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  if (!partyId) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface p-[18px]">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 text-[15px] font-bold">{P.title}</h2>
          <p className="m-0 text-sm text-muted">{P.pitch}</p>
          {startError && <p role="alert" className="m-0 text-sm text-accent-fg">{startError}</p>}
        </div>
        <button type="button" onClick={onStart} disabled={starting} className={`${btn} bg-accent text-white hover:brightness-110`}>
          {starting && <SpinnerIcon size={14} />}
          {starting ? P.starting : P.start}
        </button>
      </section>
    );
  }

  if (status === 'closed' || status === 'missing') {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface p-[18px]">
        <p className="m-0 text-sm text-fg-2">{status === 'closed' ? P.ended : P.missing}</p>
        <button type="button" onClick={onLeave} className={`${btn} border border-line-hover bg-surface-2 hover:border-fg-2`}>{P.watchSolo}</button>
      </section>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const ok = await send({ type: 'chat', text });
    if (!ok) setDraft(text);
  }

  const members = state?.members ?? [];

  return (
    <section aria-label={P.title} className="flex flex-col gap-4 rounded-panel border border-accent-line bg-surface p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            {P.title}
            <span className="font-medium text-muted">· {P.members(members.length)}</span>
          </h2>
          <p className="m-0 text-[13px] text-muted">{isHost ? P.hostNote : P.guestNote}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={`${btn} border border-line-hover bg-surface-2 hover:border-fg-2`}>
            {copied ? <CheckIcon size={14} strokeWidth={2.5} className="text-success" /> : <LinkIcon size={14} />}
            {copied ? P.copied : P.copyInvite}
          </button>
          <button type="button" onClick={isHost ? onEnd : onLeave}
            className={`${btn} border border-line-hover bg-surface-2 text-accent-fg hover:border-accent`}>
            {isHost ? P.end : P.leave}
          </button>
        </div>
      </div>

      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {members.map(m => (
          <li key={m.id} className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface-3 px-3 text-[13px]">
            {m.isHost && <span title={P.host} aria-label={P.host}>👑</span>}
            <span className="font-medium">{m.name}</span>
            {m.id === me && <span className="text-muted">({P.you})</span>}
            {m.buffering && (
              <span className="flex items-center gap-1 text-muted"><SpinnerIcon size={12} />{P.buffering}</span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 rounded-chip border border-line bg-bg">
        <div ref={listRef} className="flex max-h-56 min-h-24 flex-col gap-1.5 overflow-y-auto px-3.5 py-3" aria-live="polite">
          {chat.length === 0 && <p className="m-0 text-sm text-muted">{P.noMessages}</p>}
          {chat.map(m => (
            <p key={m.id} className="m-0 break-words text-sm leading-snug">
              <span className={`font-semibold ${m.userId === state?.hostId ? 'text-accent-fg' : 'text-fg'}`}>{m.name}</span>
              <span className="text-fg-2">: {m.text}</span>
            </p>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-2">
          <div className="flex gap-0.5">
            {PARTY_REACTIONS.map(e => (
              <button key={e} type="button" onClick={() => send({ type: 'react', emoji: e })} aria-label={P.react(e)}
                className="flex h-9 w-9 items-center justify-center rounded-btn text-lg transition-transform hover:scale-110 hover:bg-surface-3 pointer-coarse:h-11 pointer-coarse:w-11">
                {e}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex min-w-[200px] flex-1 gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} maxLength={300} placeholder={P.chatPlaceholder}
              aria-label={P.chatPlaceholder}
              className="h-9 min-w-0 flex-1 rounded-btn border border-line-strong bg-surface-2 px-3 text-sm text-fg outline-none focus:border-line-hover pointer-coarse:h-11" />
            <button type="submit" disabled={!draft.trim()} className={`${btn} bg-accent text-white hover:brightness-110`}>{P.send}</button>
          </form>
        </div>
      </div>
    </section>
  );
}

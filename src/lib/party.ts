// Watch party rooms — kept in this Node process's memory, not the DB.
//
// Nothing about the video itself goes through here: every viewer loads the
// stream from the same source on their own machine. A room only holds the
// shared "remote control" state (what's playing, where, paused or not) plus
// the chat, and fans changes out to everyone over Server-Sent Events.
//
// That means this only works with a single server process (`next start`),
// which is how the site runs. Rooms disappear on restart — fine for
// something that lives for one evening of watching.

import { randomBytes } from 'node:crypto';
import { PARTY_REACTIONS } from './party-shared';

export type PartySource =
  | { lang: 'ru'; tid: number | null }
  | { lang: 'en'; key: string | null };

export type PartyMember = { id: string; name: string; buffering: boolean; isHost: boolean };

export type PartyState = {
  id: string;
  hostId: string;
  animeId: number;
  ep: number;
  source: PartySource;
  /** What the host asked for. */
  intentPlaying: boolean;
  /** What actually happens — false while someone is buffering. */
  playing: boolean;
  /** Playback position (seconds) as of server time `at` (ms). */
  position: number;
  at: number;
  hostOnline: boolean;
  waitingFor: string[];
  members: PartyMember[];
};

export type ChatMessage = { id: string; userId: string; name: string; text: string; ts: number };

type Send = (event: string, data: unknown) => void;
type Subscriber = { send: Send; close: () => void };

type Member = {
  id: string;
  name: string;
  conns: number;
  buffering: boolean;
  bufferingSince: number;
  lastChat: number;
  lastReact: number;
};

type Room = {
  id: string;
  hostId: string;
  animeId: number;
  ep: number;
  source: PartySource;
  intentPlaying: boolean;
  effectivePlaying: boolean;
  position: number;
  at: number;
  members: Map<string, Member>;
  subs: Set<Subscriber>;
  chat: ChatMessage[];
  emptySince: number | null;
};

/** Stop waiting for someone who has been buffering longer than this. */
const BUFFER_MAX_MS = 20_000;
/** Drop a room nobody has been connected to for this long. */
const EMPTY_ROOM_TTL_MS = 10 * 60_000;
const CHAT_HISTORY = 50;
const CHAT_MAX_LEN = 300;

// Survives dev-mode hot reloads, which re-evaluate this module.
const g = globalThis as unknown as { __partyRooms?: Map<string, Room>; __partyGc?: ReturnType<typeof setInterval> };
const rooms: Map<string, Room> = (g.__partyRooms ??= new Map());

function isBuffering(m: Member, now: number) {
  return m.conns > 0 && m.buffering && now - m.bufferingSince < BUFFER_MAX_MS;
}

function currentPosition(r: Room, now: number) {
  return r.effectivePlaying ? r.position + (now - r.at) / 1000 : r.position;
}

/** Freeze the moving position into (position, at) so it can be changed safely. */
function settle(r: Room, now: number) {
  r.position = currentPosition(r, now);
  r.at = now;
}

/** Recompute "is it actually playing" (host intent minus anyone buffering). */
function recompute(r: Room, now: number): boolean {
  const waiting = [...r.members.values()].some(m => isBuffering(m, now));
  const next = r.intentPlaying && !waiting;
  if (next === r.effectivePlaying) return false;
  settle(r, now);
  r.effectivePlaying = next;
  return true;
}

function snapshot(r: Room, now: number): PartyState {
  const online = [...r.members.values()].filter(m => m.conns > 0);
  return {
    id: r.id,
    hostId: r.hostId,
    animeId: r.animeId,
    ep: r.ep,
    source: r.source,
    intentPlaying: r.intentPlaying,
    playing: r.effectivePlaying,
    position: r.position,
    at: r.at,
    hostOnline: online.some(m => m.id === r.hostId),
    waitingFor: online.filter(m => isBuffering(m, now)).map(m => m.name),
    members: online
      .map(m => ({ id: m.id, name: m.name, buffering: isBuffering(m, now), isHost: m.id === r.hostId }))
      .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.name.localeCompare(b.name)),
  };
}

function emit(r: Room, event: string, data: unknown) {
  for (const s of r.subs) s.send(event, data);
}

function broadcastState(r: Room) {
  const now = Date.now();
  emit(r, 'state', { state: snapshot(r, now), now });
}

function closeRoom(r: Room) {
  rooms.delete(r.id);
  emit(r, 'closed', { now: Date.now() });
  for (const s of [...r.subs]) s.close();
  r.subs.clear();
}

// One timer for everything: lets a stuck buffering viewer time out (so the
// room resumes) and cleans up abandoned rooms.
g.__partyGc ??= setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (r.emptySince && now - r.emptySince > EMPTY_ROOM_TTL_MS) { closeRoom(r); continue; }
    if (recompute(r, now)) broadcastState(r);
  }
}, 1000);
g.__partyGc.unref?.();

export function getRoom(id: string) {
  return rooms.get(id) ?? null;
}

export function createRoom(opts: {
  hostId: string; animeId: number; ep: number; source: PartySource; position: number; playing: boolean;
}): string {
  let id: string;
  do { id = randomBytes(6).toString('base64url'); } while (rooms.has(id));
  const now = Date.now();
  rooms.set(id, {
    id,
    hostId: opts.hostId,
    animeId: opts.animeId,
    ep: opts.ep,
    source: opts.source,
    intentPlaying: opts.playing,
    effectivePlaying: opts.playing,
    position: Math.max(0, opts.position),
    at: now,
    members: new Map(),
    subs: new Set(),
    chat: [],
    emptySince: now,
  });
  return id;
}

/** Registers an SSE connection; returns the function to call when it drops. */
export function joinRoom(r: Room, user: { id: string; name: string }, sub: Subscriber): () => void {
  const now = Date.now();
  let m = r.members.get(user.id);
  if (!m) {
    m = { id: user.id, name: user.name, conns: 0, buffering: false, bufferingSince: 0, lastChat: 0, lastReact: 0 };
    r.members.set(user.id, m);
  }
  m.conns += 1;
  r.subs.add(sub);
  r.emptySince = null;

  sub.send('init', { state: snapshot(r, now), chat: r.chat, you: user.id, now });
  broadcastState(r);

  let left = false;
  return () => {
    if (left) return;
    left = true;
    r.subs.delete(sub);
    m.conns = Math.max(0, m.conns - 1);
    if (m.conns === 0) m.buffering = false;
    if (r.subs.size === 0) r.emptySince = Date.now();
    if (!rooms.has(r.id)) return;
    recompute(r, Date.now());
    broadcastState(r);
  };
}

export type PartyAction =
  | { type: 'control'; playing: boolean; position: number }
  | { type: 'media'; animeId: number; ep: number; source: PartySource }
  | { type: 'buffering'; value: boolean }
  | { type: 'chat'; text: string }
  | { type: 'react'; emoji: string }
  | { type: 'end' };

export type ActionResult = { ok: true } | { ok: false; status: number; error: string };

function isSource(s: unknown): s is PartySource {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  if (o.lang === 'ru') return o.tid === null || typeof o.tid === 'number';
  if (o.lang === 'en') return o.key === null || typeof o.key === 'string';
  return false;
}

export function applyAction(r: Room, userId: string, a: PartyAction): ActionResult {
  const now = Date.now();
  const m = r.members.get(userId);
  if (!m) return { ok: false, status: 403, error: 'Not in this party' };
  const isHost = userId === r.hostId;
  const hostOnly = (): ActionResult => ({ ok: false, status: 403, error: 'Only the host can do that' });

  switch (a.type) {
    case 'control': {
      if (!isHost) return hostOnly();
      if (typeof a.playing !== 'boolean' || !Number.isFinite(a.position)) break;
      settle(r, now);
      r.position = Math.max(0, a.position);
      r.intentPlaying = a.playing;
      recompute(r, now);
      broadcastState(r);
      return { ok: true };
    }
    case 'media': {
      if (!isHost) return hostOnly();
      if (!Number.isInteger(a.animeId) || !Number.isInteger(a.ep) || a.ep < 1 || !isSource(a.source)) break;
      const sameSource = JSON.stringify(a.source) === JSON.stringify(r.source);
      if (a.animeId === r.animeId && a.ep === r.ep && sameSource) return { ok: true };
      if (a.animeId !== r.animeId || a.ep !== r.ep) {
        // New episode: everyone starts from the top together.
        r.animeId = a.animeId;
        r.ep = a.ep;
        r.position = 0;
        r.at = now;
        r.intentPlaying = true;
        r.effectivePlaying = false;
        recompute(r, now);
      }
      r.source = a.source;
      broadcastState(r);
      return { ok: true };
    }
    case 'buffering': {
      const value = !!a.value;
      if (m.buffering === value) return { ok: true };
      m.buffering = value;
      if (value) m.bufferingSince = now;
      recompute(r, now);
      broadcastState(r);
      return { ok: true };
    }
    case 'chat': {
      const text = typeof a.text === 'string' ? a.text.trim().slice(0, CHAT_MAX_LEN) : '';
      if (!text) break;
      if (now - m.lastChat < 400) return { ok: false, status: 429, error: 'Slow down' };
      m.lastChat = now;
      const msg: ChatMessage = { id: randomBytes(6).toString('base64url'), userId, name: m.name, text, ts: now };
      r.chat.push(msg);
      if (r.chat.length > CHAT_HISTORY) r.chat.splice(0, r.chat.length - CHAT_HISTORY);
      emit(r, 'chat', msg);
      return { ok: true };
    }
    case 'react': {
      if (!(PARTY_REACTIONS as readonly string[]).includes(a.emoji)) break;
      if (now - m.lastReact < 250) return { ok: true };
      m.lastReact = now;
      emit(r, 'react', { id: randomBytes(4).toString('hex'), emoji: a.emoji, name: m.name, userId });
      return { ok: true };
    }
    case 'end': {
      if (!isHost) return hostOnly();
      closeRoom(r);
      return { ok: true };
    }
  }
  return { ok: false, status: 400, error: 'Bad request' };
}

export { isSource };

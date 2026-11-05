// Bits of the watch party protocol shared by server and browser code.
export const PARTY_REACTIONS = ['😂', '😮', '😭', '🔥', '❤️', '👏'] as const;
export const PARTY_ID_RE = /^[A-Za-z0-9_-]{4,16}$/;

// Bits of the watch party protocol shared by server and browser code.
export const PARTY_REACTIONS = ['😂', '🤣', '😮', '😱', '😭', '🥺', '💀', '🔥', '❤️', '👏', '🎉', '👀'] as const;
export const PARTY_ID_RE = /^[A-Za-z0-9_-]{4,16}$/;

/** One open room as shown in the home page's "live parties" row. */
export type PartyListing = {
  id: string;
  animeId: number;
  ep: number;
  lang: 'ru' | 'en';
  hostName: string;
  watching: number;
  playing: boolean;
  /** Seconds into the episode right now. */
  position: number;
  title: string;
  image: string | null;
  color: string | null;
};

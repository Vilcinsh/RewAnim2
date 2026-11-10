// Server-only: open watch parties joined with their anime's title and art,
// for the home page row (rendered on the server, then polled via GET /api/party).
import { listRooms } from './party';
import { getAnimeByIds, displayTitle } from './anilist';
import type { PartyListing } from './party-shared';

export async function getLiveParties(): Promise<PartyListing[]> {
  const rooms = listRooms().filter(r => r.hostOnline).slice(0, 30);
  if (!rooms.length) return [];
  const media = await getAnimeByIds(rooms.map(r => r.animeId)).catch(() => []);
  const byId = new Map(media.map(m => [m.id, m]));
  return rooms.map(r => {
    const m = byId.get(r.animeId);
    return {
      id: r.id,
      animeId: r.animeId,
      ep: r.ep,
      lang: r.lang,
      hostName: r.hostName,
      watching: r.watching,
      playing: r.playing,
      position: r.position,
      title: m ? displayTitle(m) : `#${r.animeId}`,
      image: m?.bannerImage ?? m?.coverImage.extraLarge ?? null,
      color: m?.coverImage.color ?? null,
    };
  });
}

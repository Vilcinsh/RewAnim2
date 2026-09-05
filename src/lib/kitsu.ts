import { fetchWithTimeout } from './fetch-timeout';
import type { AnimeMedia } from './anilist';

// Fallback metadata source for when AniList's API is down (it disables
// itself outright during "stability issues" rather than just rate-limiting
// — see anilist.ts's query()). Kitsu exposes a mapping to the AniList id
// for each anime, which is what lets a Kitsu-sourced result still slot into
// every AniList-id-keyed route in this app (/anime/:id, /watch/:id, and
// every streaming provider downstream of those). An anime with no AniList
// mapping on Kitsu is filtered out rather than shown half-broken.
const KITSU_URL = 'https://kitsu.io/api/edge';

const memCache = new Map<string, { data: unknown; expires: number }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memCache.get(key);
  if (hit && Date.now() < hit.expires) return Promise.resolve(hit.data as T);
  return fn().then(data => {
    memCache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}
const TTL = { search: 5 * 60 * 1000, byId: 30 * 60 * 1000 };

type KitsuImage = { tiny?: string; small?: string; medium?: string; large?: string; original?: string };
type KitsuAnimeAttrs = {
  canonicalTitle: string;
  titles: Record<string, string | undefined>;
  synopsis: string | null;
  posterImage: KitsuImage | null;
  coverImage: KitsuImage | null;
  averageRating: string | null;
  episodeCount: number | null;
  startDate: string | null;
  subtype: string | null;
  status: string;
  nsfw: boolean;
};
type KitsuMappingAttrs = { externalSite: string; externalId: string };
type KitsuCategoryAttrs = { title: string };
type KitsuRef = { type: string; id: string };
type KitsuResource<T> = { id: string; type: string; attributes: T; relationships?: Record<string, { data?: KitsuRef | KitsuRef[] }> };

const STATUS_MAP: Record<string, AnimeMedia['status']> = {
  current: 'RELEASING',
  finished: 'FINISHED',
  upcoming: 'NOT_YET_RELEASED',
  unreleased: 'NOT_YET_RELEASED',
  tba: 'NOT_YET_RELEASED',
};

const FORMAT_MAP: Record<string, NonNullable<AnimeMedia['format']>> = {
  TV: 'TV',
  movie: 'MOVIE',
  OVA: 'OVA',
  ONA: 'ONA',
  special: 'SPECIAL',
  music: 'MUSIC',
};

function seasonFromDate(dateStr: string | null): { season: AnimeMedia['season']; year: number | null } {
  if (!dateStr) return { season: null, year: null };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { season: null, year: null };
  const month = d.getUTCMonth();
  const season: AnimeMedia['season'] =
    month <= 1 || month === 11 ? 'WINTER' : month <= 4 ? 'SPRING' : month <= 7 ? 'SUMMER' : 'FALL';
  return { season, year: d.getUTCFullYear() };
}

// Resolves this anime's `mappings`/`categories` relationship refs against
// the response's top-level `included` array (standard JSON:API sideloading
// — refs are per-item even when many anime share one `included` array, as
// with a search result page).
function mapAnime(
  attrs: KitsuAnimeAttrs,
  relationships: Record<string, { data?: KitsuRef | KitsuRef[] }> | undefined,
  includedByKey: Map<string, KitsuResource<KitsuMappingAttrs | KitsuCategoryAttrs>>
): AnimeMedia | null {
  if (attrs.nsfw) return null;

  const mappingRefs = (relationships?.mappings?.data as KitsuRef[] | undefined) ?? [];
  let anilistId: number | null = null;
  let malId: number | null = null;
  for (const ref of mappingRefs) {
    const res = includedByKey.get(`${ref.type}:${ref.id}`);
    const m = res?.attributes as KitsuMappingAttrs | undefined;
    if (!m) continue;
    if (m.externalSite === 'anilist/anime') anilistId = Number(m.externalId);
    if (m.externalSite === 'myanimelist/anime') malId = Number(m.externalId);
  }
  if (!anilistId) return null;

  const categoryRefs = (relationships?.categories?.data as KitsuRef[] | undefined) ?? [];
  const genres = categoryRefs
    .map(ref => (includedByKey.get(`${ref.type}:${ref.id}`)?.attributes as KitsuCategoryAttrs | undefined)?.title)
    .filter((g): g is string => !!g);

  const { season, year } = seasonFromDate(attrs.startDate);
  const poster = attrs.posterImage;
  const banner = attrs.coverImage;

  return {
    id: anilistId,
    idMal: malId,
    title: {
      romaji: attrs.canonicalTitle,
      english: attrs.titles.en ?? null,
      native: attrs.titles.ja_jp ?? attrs.canonicalTitle,
    },
    coverImage: {
      extraLarge: poster?.original ?? poster?.large ?? '',
      large: poster?.large ?? poster?.medium ?? '',
      medium: poster?.medium ?? poster?.small ?? '',
      color: null,
    },
    bannerImage: banner?.original ?? banner?.large ?? null,
    description: attrs.synopsis ?? null,
    status: STATUS_MAP[attrs.status] ?? 'FINISHED',
    format: attrs.subtype ? (FORMAT_MAP[attrs.subtype] ?? null) : null,
    episodes: attrs.episodeCount ?? null,
    averageScore: attrs.averageRating ? Math.round(parseFloat(attrs.averageRating)) : null,
    popularity: 0,
    genres,
    season,
    seasonYear: year,
    nextAiringEpisode: null,
    studios: { nodes: [] },
  };
}

function buildIncludedIndex(included: KitsuResource<KitsuMappingAttrs | KitsuCategoryAttrs>[] | undefined) {
  const map = new Map<string, KitsuResource<KitsuMappingAttrs | KitsuCategoryAttrs>>();
  for (const res of included ?? []) map.set(`${res.type}:${res.id}`, res);
  return map;
}

export function searchAnimeKitsu(search: string, perPage = 20): Promise<AnimeMedia[]> {
  return cached(`search:${search}:${perPage}`, TTL.search, async () => {
    const url = new URL(`${KITSU_URL}/anime`);
    url.searchParams.set('filter[text]', search);
    url.searchParams.set('include', 'mappings,categories');
    url.searchParams.set('page[limit]', String(Math.min(perPage, 20))); // Kitsu's own cap

    const res = await fetchWithTimeout(url.toString(), { headers: { Accept: 'application/vnd.api+json' } }, 8000);
    if (!res.ok) throw new Error(`Kitsu search error: ${res.status}`);
    const json = await res.json();

    const includedByKey = buildIncludedIndex(json.included);
    const items: KitsuResource<KitsuAnimeAttrs>[] = json.data ?? [];
    return items
      .map(item => mapAnime(item.attributes, item.relationships, includedByKey))
      .filter((a): a is AnimeMedia => a !== null);
  });
}

export function getAnimeByIdKitsu(anilistId: number): Promise<AnimeMedia | null> {
  return cached(`anime:${anilistId}`, TTL.byId, async () => {
    const mapUrl = new URL(`${KITSU_URL}/mappings`);
    mapUrl.searchParams.set('filter[externalSite]', 'anilist/anime');
    mapUrl.searchParams.set('filter[externalId]', String(anilistId));
    mapUrl.searchParams.set('include', 'item');

    const mapRes = await fetchWithTimeout(mapUrl.toString(), { headers: { Accept: 'application/vnd.api+json' } }, 8000);
    if (!mapRes.ok) throw new Error(`Kitsu mapping lookup error: ${mapRes.status}`);
    const mapJson = await mapRes.json();
    const kitsuAnime = (mapJson.included ?? []).find((r: { type: string }) => r.type === 'anime');
    if (!kitsuAnime) return null;

    const fullUrl = new URL(`${KITSU_URL}/anime/${kitsuAnime.id}`);
    fullUrl.searchParams.set('include', 'mappings,categories');
    const fullRes = await fetchWithTimeout(fullUrl.toString(), { headers: { Accept: 'application/vnd.api+json' } }, 8000);
    if (!fullRes.ok) throw new Error(`Kitsu anime fetch error: ${fullRes.status}`);
    const fullJson = await fullRes.json();

    const includedByKey = buildIncludedIndex(fullJson.included);
    const item: KitsuResource<KitsuAnimeAttrs> = fullJson.data;
    return mapAnime(item.attributes, item.relationships, includedByKey);
  });
}

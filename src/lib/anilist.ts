import {
  searchAnimeKitsu, getAnimeByIdKitsu,
  getTrendingKitsu, getPopularKitsu, getCurrentlyAiringKitsu, getTopRatedKitsu, getNewlyCompletedKitsu,
} from './kitsu';
import { strings } from './strings';

const ANILIST_URL = 'https://graphql.anilist.co';

// In-memory cache — survives across requests in the same server process
const memCache = new Map<string, { data: unknown; expires: number }>();

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = memCache.get(key);
  if (hit && Date.now() < hit.expires) return Promise.resolve(hit.data as T);
  return fn().then(data => {
    memCache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

// Every list-returning function below is normally called in a Promise.all
// alongside several others (the dashboard alone fires 6+) — one throwing
// used to fail the entire page, not just its own row, whenever AniList has
// an outage (it occasionally disables its whole API outright rather than
// just rate-limiting). Falls back to `fallback` if given (a Kitsu-backed
// best-effort equivalent for the homepage's main rows) and ultimately to an
// empty list so the rest of the page still renders either way. Deliberately
// doesn't cache the empty-list case the way `cached()` caches real results
// — these lists have TTLs up to an hour, and caching a failure that long
// would keep showing empty sections long after AniList actually recovers,
// instead of the very next request picking it back up.
function cachedList<T>(key: string, ttlMs: number, fn: () => Promise<T[]>, fallback?: () => Promise<T[]>): Promise<T[]> {
  const hit = memCache.get(key);
  if (hit && Date.now() < hit.expires) return Promise.resolve(hit.data as T[]);
  return fn()
    .then(data => {
      memCache.set(key, { data, expires: Date.now() + ttlMs });
      return data;
    })
    .catch(async () => {
      if (!fallback) return [];
      try { return await fallback(); } catch { return []; }
    });
}

const TTL = {
  trending:    10 * 60 * 1000,  // 10 min — changes often
  airing:      10 * 60 * 1000,
  popular:     60 * 60 * 1000,  // 1 hour — stable
  topRated:    60 * 60 * 1000,
  completed:   30 * 60 * 1000,  // 30 min
  animeById:   30 * 60 * 1000,
  search:       5 * 60 * 1000,  // 5 min
  filtered:     5 * 60 * 1000,
  byGenre:     15 * 60 * 1000,
  schedule:    10 * 60 * 1000,
  recs:        60 * 60 * 1000,
};

export type AnimeMedia = {
  id: number;
  idMal: number | null;
  title: {
    romaji: string;
    english: string | null;
    native: string;
  };
  coverImage: {
    extraLarge: string;
    large: string;
    medium: string;
    color: string | null;
  };
  bannerImage: string | null;
  description: string | null;
  status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  format: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC' | null;
  episodes: number | null;
  averageScore: number | null;
  popularity: number;
  genres: string[];
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
  studios: {
    nodes: { name: string }[];
  };
  /** Missing on Kitsu-sourced fallbacks. */
  trailer?: { id: string; site: string } | null;
};

export type AiringItem = {
  episode: number;
  airingAt: number;
  media: AnimeMedia;
};

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large medium color }
  bannerImage
  description(asHtml: false)
  status
  format
  episodes
  averageScore
  popularity
  genres
  season
  seasonYear
  startDate { year month day }
  nextAiringEpisode { airingAt episode }
  studios(isMain: true) { nodes { name } }
  trailer { id site }
`;

// AniList currently caps this at 30 req/min per IP, shared across every
// user of this app (all calls originate server-side). Several pages fire
// multiple queries in parallel (dashboard alone fires 5), so without this
// gate normal browsing blows through the limit and every over-budget call
// used to fail silently into "no results" everywhere, search included.
// This paces requests against a locally tracked budget (self-corrected
// from AniList's own X-RateLimit-* response headers when present) and
// retries once on an actual 429, honoring Retry-After.
const RATE_LIMIT = 30;
const RATE_LIMIT_SAFETY_MARGIN = 3;
const WINDOW_MS = 60 * 1000;
let tokens = RATE_LIMIT;
let windowResetAt = Date.now() + WINDOW_MS;
let gate: Promise<void> = Promise.resolve();

function reserveSlot(): Promise<void> {
  const next = gate.then(async () => {
    const now = Date.now();
    if (now >= windowResetAt) {
      tokens = RATE_LIMIT;
      windowResetAt = now + WINDOW_MS;
    }
    if (tokens <= RATE_LIMIT_SAFETY_MARGIN) {
      const wait = windowResetAt - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      tokens = RATE_LIMIT;
      windowResetAt = Date.now() + WINDOW_MS;
    }
    tokens -= 1;
  });
  gate = next.catch(() => {});
  return next;
}

async function query<T>(q: string, variables?: Record<string, unknown>, isRetry = false): Promise<T> {
  await reserveSlot();

  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: q, variables }),
    next: { revalidate: 300 },
  });

  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset = res.headers.get('x-ratelimit-reset');
  if (remaining !== null) tokens = Math.min(tokens, Number(remaining));
  if (reset !== null) windowResetAt = Number(reset) * 1000;

  if (res.status === 429 && !isRetry) {
    const retryAfterSec = Number(res.headers.get('retry-after') ?? '10');
    await new Promise(r => setTimeout(r, (retryAfterSec + 1) * 1000));
    return query<T>(q, variables, true);
  }

  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

export function getTrending(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cachedList(`trending:${page}:${perPage}`, TTL.trending, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  }, () => getTrendingKitsu(perPage));
}

export function getPopular(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cachedList(`popular:${page}:${perPage}`, TTL.popular, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  }, () => getPopularKitsu(perPage));
}

export function getCurrentlyAiring(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cachedList(`airing:${page}:${perPage}`, TTL.airing, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  }, () => getCurrentlyAiringKitsu(perPage));
}

// Currently-airing anime ordered by AniList's own "last updated" timestamp
// rather than popularity — that field moves whenever a show's episode
// count/data gets touched, which in practice tracks closely with a new
// episode having just aired. Same idea as the "Recently Updated" section on
// other anime sites, without needing a per-episode release feed of our own.
export function getRecentlyUpdated(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cachedList(`recentlyUpdated:${page}:${perPage}`, TTL.airing, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  });
}

// AniList occasionally disables its whole API outright ("temporarily
// disabled due to severe stability issues") rather than just rate-limiting
// — when that happens every search would otherwise silently return zero
// results. Kitsu is a reasonable stand-in since it publishes a mapping to
// each anime's AniList id, so a fallback result still links correctly into
// every AniList-id-keyed route in this app (see kitsu.ts for the mapping).
export function searchAnime(search: string, page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cached(`search:${search}:${page}:${perPage}`, TTL.search, async () => {
    try {
      const data = await query<{ Page: { media: AnimeMedia[] } }>(`
        query ($search: String, $page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(type: ANIME, search: $search, isAdult: false) { ${MEDIA_FIELDS} }
          }
        }
      `, { search, page, perPage });
      return data.Page.media;
    } catch {
      try { return await searchAnimeKitsu(search, perPage); } catch { return []; }
    }
  });
}

// Falls back the same way searchAnime does — needed so a Kitsu-sourced
// search result (picked up while AniList is down) can still be clicked
// through to a working detail/watch page instead of hitting the same
// outage a second time.
export function getAnimeById(id: number): Promise<AnimeMedia | null> {
  return cached(`anime:${id}`, TTL.animeById, async () => {
    try {
      const data = await query<{ Media: AnimeMedia }>(`
        query ($id: Int) {
          Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} }
        }
      `, { id });
      return data.Media ?? null;
    } catch {
      try { return await getAnimeByIdKitsu(id); } catch { return null; }
    }
  });
}

export function getAnimeByGenres(genres: string[], excludeIds: number[], page = 1, perPage = 20): Promise<AnimeMedia[]> {
  if (!genres.length) return Promise.resolve([]);
  const key = `byGenre:${genres.sort().join(',')}:${page}:${perPage}`;
  return cachedList(key, TTL.byGenre, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($genres: [String], $excludeIds: [Int], $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, genre_in: $genres, id_not_in: $excludeIds, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { genres, excludeIds, page, perPage });
    return data.Page.media;
  });
}

export function getTopRated(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cachedList(`topRated:${page}:${perPage}`, TTL.topRated, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: SCORE_DESC, isAdult: false, episodes_greater: 1, averageScore_greater: 70) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  }, () => getTopRatedKitsu(perPage));
}

export function getNewlyCompleted(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cachedList(`completed:${page}:${perPage}`, TTL.completed, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: FINISHED, sort: END_DATE_DESC, isAdult: false, episodes_greater: 1) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  }, () => getNewlyCompletedKitsu(perPage));
}

export type AnimeFilters = {
  search?: string;
  genre?: string;
  format?: string;
  status?: string;
  year?: number;
  season?: string;
  sort?: string;
};

export function getFilteredAnime(filters: AnimeFilters, page = 1, perPage = 50): Promise<AnimeMedia[]> {
  const cacheKey = `filtered:${JSON.stringify(filters)}:${page}:${perPage}`;
  return cachedList(cacheKey, TTL.filtered, async () => {
    const vars: Record<string, unknown> = { page, perPage };
    const args: string[] = ['type: ANIME', 'isAdult: false'];
    const gqlVars: string[] = ['$page: Int', '$perPage: Int'];

    if (filters.search) { args.push('search: $search'); gqlVars.push('$search: String'); vars.search = filters.search; }
    if (filters.genre) { args.push('genre_in: [$genre]'); gqlVars.push('$genre: String'); vars.genre = filters.genre; }
    if (filters.format) { args.push('format: $format'); gqlVars.push('$format: MediaFormat'); vars.format = filters.format; }
    if (filters.status) { args.push('status: $status'); gqlVars.push('$status: MediaStatus'); vars.status = filters.status; }
    if (filters.year) { args.push('seasonYear: $year'); gqlVars.push('$year: Int'); vars.year = filters.year; }
    if (filters.season) { args.push('season: $season'); gqlVars.push('$season: MediaSeason'); vars.season = filters.season; }

    const ALLOWED_SORTS = ['TRENDING_DESC', 'POPULARITY_DESC', 'SCORE_DESC', 'START_DATE_DESC', 'TITLE_ROMAJI', 'SEARCH_MATCH'];
    // A text search without an explicit sort should rank by relevance.
    const sortVal = ALLOWED_SORTS.includes(filters.sort ?? '') ? filters.sort! : filters.search ? 'SEARCH_MATCH' : 'TRENDING_DESC';
    args.push(`sort: ${sortVal}`);

    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query (${gqlVars.join(', ')}) {
        Page(page: $page, perPage: $perPage) {
          media(${args.join(', ')}) { ${MEDIA_FIELDS} }
        }
      }
    `, vars);
    return data.Page.media;
  });
}

export function getAnimePageRandom(page: number, perPage = 20): Promise<AnimeMedia[]> {
  return cachedList(`random:${page}:${perPage}`, TTL.popular, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC, isAdult: false, episodes_greater: 1) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  });
}

/** Episodes airing in [from, to) (unix seconds), oldest first. Adult titles excluded. */
export function getAiringSchedule(from: number, to: number): Promise<AiringItem[]> {
  return cachedList(`schedule:${from}:${to}`, TTL.schedule, async () => {
    const out: AiringItem[] = [];
    for (let page = 1; page <= 3; page++) {
      const data = await query<{ Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: (AiringItem & { media: AnimeMedia & { isAdult: boolean } })[] } }>(`
        query ($from: Int, $to: Int, $page: Int) {
          Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
              episode
              airingAt
              media { ${MEDIA_FIELDS} isAdult }
            }
          }
        }
      `, { from: from - 1, to, page });
      out.push(...data.Page.airingSchedules.filter(s => s.media && !s.media.isAdult));
      if (!data.Page.pageInfo.hasNextPage) break;
    }
    return out;
  });
}

export type AnimeRelation = {
  relationType: string;
  node: Pick<AnimeMedia, 'id' | 'title' | 'format' | 'status' | 'episodes'> & {
    type: 'ANIME' | 'MANGA';
    coverImage: { medium: string; color: string | null };
  };
};

export type AnimeDetails = AnimeMedia & {
  duration: number | null;
  source: string | null;
  /** Licensed-stream episode titles/stills (not every show has them). */
  streamingEpisodes: { title: string; thumbnail: string }[];
  /** Known air times, aired and upcoming, ordered by episode. */
  airingSchedule: { episode: number; airingAt: number }[];
  relations: AnimeRelation[];
};

/** Everything the anime and watch pages need; falls back to the basic record (Kitsu) without extras. */
export function getAnimeDetails(id: number): Promise<AnimeDetails | null> {
  return cached(`details:${id}`, TTL.animeById, async () => {
    try {
      const data = await query<{ Media: (AnimeMedia & {
        duration: number | null; source: string | null;
        streamingEpisodes: { title: string; thumbnail: string }[] | null;
        airingSchedule: { nodes: { episode: number; airingAt: number }[] } | null;
        relations: { edges: AnimeRelation[] } | null;
      }) | null }>(`
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            ${MEDIA_FIELDS}
            duration
            source
            streamingEpisodes { title thumbnail }
            airingSchedule(perPage: 50) { nodes { episode airingAt } }
            relations {
              edges {
                relationType
                node { id type title { romaji english native } format status episodes coverImage { medium color } }
              }
            }
          }
        }
      `, { id });
      const m = data.Media;
      if (!m) return null;
      return {
        ...m,
        streamingEpisodes: m.streamingEpisodes ?? [],
        airingSchedule: m.airingSchedule?.nodes ?? [],
        relations: m.relations?.edges ?? [],
      };
    } catch {
      const basic = await getAnimeById(id);
      return basic ? { ...basic, duration: null, source: null, streamingEpisodes: [], airingSchedule: [], relations: [] } : null;
    }
  });
}

/** Matches AniList streamingEpisodes ("Episode 3 - First Steps") to episode numbers. */
export function streamingEpisodeMap(eps: AnimeDetails['streamingEpisodes']): Map<number, { title: string | null; thumbnail: string }> {
  const map = new Map<number, { title: string | null; thumbnail: string }>();
  for (const e of eps) {
    const m = e.title.match(/^Episode\s+(\d+)\s*[-–:]?\s*(.*)$/i);
    if (!m) continue;
    const n = Number(m[1]);
    if (!map.has(n)) map.set(n, { title: m[2]?.trim() || null, thumbnail: e.thumbnail });
  }
  return map;
}

export function getAnimeByIds(ids: number[]): Promise<AnimeMedia[]> {
  const unique = [...new Set(ids)].slice(0, 50);
  if (!unique.length) return Promise.resolve([]);
  return cachedList(`byIds:${[...unique].sort((a, b) => a - b).join(',')}`, TTL.animeById, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} }
        }
      }
    `, { ids: unique });
    return data.Page.media;
  });
}

/** AniList user recommendations for each source id, fetched in one aliased query. */
export function getRecommendationsFor(ids: number[], perSource = 12): Promise<{ sourceId: number; items: AnimeMedia[] }[]> {
  const unique = [...new Set(ids)].slice(0, 4);
  if (!unique.length) return Promise.resolve([]);
  return cachedList(`recs:${unique.join(',')}:${perSource}`, TTL.recs, async () => {
    const body = unique.map((id, i) => `
      r${i}: Media(id: ${Number(id)}, type: ANIME) {
        recommendations(sort: RATING_DESC, perPage: ${perSource}) {
          nodes { mediaRecommendation { ${MEDIA_FIELDS} isAdult } }
        }
      }`).join('\n');
    type Recs = { recommendations: { nodes: { mediaRecommendation: (AnimeMedia & { isAdult: boolean }) | null }[] } } | null;
    const data = await query<Record<string, Recs>>(`query { ${body} }`);
    return unique.map((sourceId, i) => ({
      sourceId,
      items: (data[`r${i}`]?.recommendations.nodes ?? [])
        .map(n => n.mediaRecommendation)
        .filter((m): m is AnimeMedia & { isAdult: boolean } => !!m && !m.isAdult),
    }));
  });
}

/** Franchise key for de-duplicating rows: "Black Clover Season 2" ≈ "Black Clover". */
export function franchiseKey(anime: Pick<AnimeMedia, 'title'>): string {
  return (anime.title.romaji || anime.title.english || '')
    .toLowerCase()
    .replace(/[:\-–—(].*$/, '')
    .replace(/\b(season|part|cour)\s*\d+\b|\b\d+(st|nd|rd|th)\s+season\b|\bs\d+\b|\b(ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatScore(score: number | null): string {
  if (!score) return '—';
  return (score / 10).toFixed(1);
}

export function formatStatus(status: AnimeMedia['status']): string {
  return strings.status[status] ?? status;
}

export function formatFormat(format: AnimeMedia['format']): string {
  if (!format) return '';
  return strings.format[format] ?? format;
}

/** Episodes that have actually aired. AniList `nextAiringEpisode` wins over
 *  `episodes` for running shows — use this everywhere instead of reading
 *  `episodes` directly so catalog and anime page agree. */
export function airedEpisodes(anime: Pick<AnimeMedia, 'status' | 'episodes' | 'nextAiringEpisode'>): number | null {
  if (anime.nextAiringEpisode) return Math.max(anime.nextAiringEpisode.episode - 1, 0);
  if (anime.status === 'NOT_YET_RELEASED') return 0;
  return anime.episodes;
}

/** "Ep 3 / 12" while airing, "12 ep · Finished" when done. */
export function episodeLabel(anime: Pick<AnimeMedia, 'status' | 'episodes' | 'nextAiringEpisode'>): string {
  if (anime.status === 'NOT_YET_RELEASED') return strings.episode.notYetAired;
  if (anime.status === 'RELEASING' || anime.status === 'HIATUS') {
    const aired = airedEpisodes(anime);
    if (aired != null) return strings.episode.progress(aired, anime.episodes);
  }
  if (anime.episodes) {
    return anime.status === 'FINISHED' ? strings.episode.finished(anime.episodes) : strings.episode.count(anime.episodes);
  }
  return formatStatus(anime.status);
}

export function displayTitle(anime: Pick<AnimeMedia, 'title'>): string {
  return anime.title.english ?? anime.title.romaji;
}

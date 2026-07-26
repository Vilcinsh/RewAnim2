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
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
  studios: {
    nodes: { name: string }[];
  };
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
  nextAiringEpisode { airingAt episode }
  studios(isMain: true) { nodes { name } }
`;

async function query<T>(q: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: q, variables }),
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

export function getTrending(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cached(`trending:${page}:${perPage}`, TTL.trending, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  });
}

export function getPopular(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cached(`popular:${page}:${perPage}`, TTL.popular, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  });
}

export function getCurrentlyAiring(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cached(`airing:${page}:${perPage}`, TTL.airing, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  });
}

export function searchAnime(search: string, page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cached(`search:${search}:${page}:${perPage}`, TTL.search, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, search: $search, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }
    `, { search, page, perPage });
    return data.Page.media;
  });
}

export function getAnimeById(id: number): Promise<AnimeMedia | null> {
  return cached(`anime:${id}`, TTL.animeById, async () => {
    const data = await query<{ Media: AnimeMedia }>(`
      query ($id: Int) {
        Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} }
      }
    `, { id });
    return data.Media ?? null;
  });
}

export function getAnimeByGenres(genres: string[], excludeIds: number[], page = 1, perPage = 20): Promise<AnimeMedia[]> {
  if (!genres.length) return Promise.resolve([]);
  const key = `byGenre:${genres.sort().join(',')}:${page}:${perPage}`;
  return cached(key, TTL.byGenre, async () => {
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
  return cached(`topRated:${page}:${perPage}`, TTL.topRated, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, sort: SCORE_DESC, isAdult: false, episodes_greater: 1, averageScore_greater: 70) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  });
}

export function getNewlyCompleted(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  return cached(`completed:${page}:${perPage}`, TTL.completed, async () => {
    const data = await query<{ Page: { media: AnimeMedia[] } }>(`
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, status: FINISHED, sort: END_DATE_DESC, isAdult: false, episodes_greater: 1) { ${MEDIA_FIELDS} }
        }
      }
    `, { page, perPage });
    return data.Page.media;
  });
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
  return cached(cacheKey, TTL.filtered, async () => {
    const vars: Record<string, unknown> = { page, perPage };
    const args: string[] = ['type: ANIME', 'isAdult: false'];
    const gqlVars: string[] = ['$page: Int', '$perPage: Int'];

    if (filters.search) { args.push('search: $search'); gqlVars.push('$search: String'); vars.search = filters.search; }
    if (filters.genre) { args.push('genre_in: [$genre]'); gqlVars.push('$genre: String'); vars.genre = filters.genre; }
    if (filters.format) { args.push('format: $format'); gqlVars.push('$format: MediaFormat'); vars.format = filters.format; }
    if (filters.status) { args.push('status: $status'); gqlVars.push('$status: MediaStatus'); vars.status = filters.status; }
    if (filters.year) { args.push('seasonYear: $year'); gqlVars.push('$year: Int'); vars.year = filters.year; }
    if (filters.season) { args.push('season: $season'); gqlVars.push('$season: MediaSeason'); vars.season = filters.season; }

    const ALLOWED_SORTS = ['TRENDING_DESC', 'POPULARITY_DESC', 'SCORE_DESC', 'START_DATE_DESC', 'TITLE_ROMAJI'];
    const sortVal = ALLOWED_SORTS.includes(filters.sort ?? '') ? filters.sort! : 'TRENDING_DESC';
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
  return cached(`random:${page}:${perPage}`, TTL.popular, async () => {
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

export function formatScore(score: number | null): string {
  if (!score) return '—';
  return (score / 10).toFixed(1);
}

export function formatStatus(status: AnimeMedia['status']): string {
  const map: Record<AnimeMedia['status'], string> = {
    RELEASING: 'Ongoing',
    FINISHED: 'Pabeigts',
    NOT_YET_RELEASED: 'Drīzumā',
    CANCELLED: 'Atcelts',
    HIATUS: 'Pauze',
  };
  return map[status] ?? status;
}

export function formatFormat(format: AnimeMedia['format']): string {
  if (!format) return '';
  const map: Record<string, string> = {
    TV: 'TV',
    TV_SHORT: 'TV Short',
    MOVIE: 'Filma',
    SPECIAL: 'Speciāls',
    OVA: 'OVA',
    ONA: 'ONA',
    MUSIC: 'Mūzika',
  };
  return map[format] ?? format;
}

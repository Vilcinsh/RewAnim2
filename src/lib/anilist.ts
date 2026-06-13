const ANILIST_URL = 'https://graphql.anilist.co';

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

export async function getTrending(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });
  return data.Page.media;
}

export async function getPopular(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });
  return data.Page.media;
}

export async function getCurrentlyAiring(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });
  return data.Page.media;
}

export async function searchAnime(search: string, page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, search: $search, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { search, page, perPage });
  return data.Page.media;
}

export async function getAnimeById(id: number): Promise<AnimeMedia | null> {
  const data = await query<{ Media: AnimeMedia }>(`
    query ($id: Int) {
      Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} }
    }
  `, { id });
  return data.Media ?? null;
}

export async function getAnimeByGenres(genres: string[], excludeIds: number[], page = 1, perPage = 20): Promise<AnimeMedia[]> {
  if (!genres.length) return [];
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($genres: [String], $excludeIds: [Int], $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, genre_in: $genres, id_not_in: $excludeIds, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { genres, excludeIds, page, perPage });
  return data.Page.media;
}

export async function getTopRated(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: SCORE_DESC, isAdult: false, episodes_greater: 1, averageScore_greater: 70) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });
  return data.Page.media;
}

export async function getNewlyCompleted(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, status: FINISHED, sort: END_DATE_DESC, isAdult: false, episodes_greater: 1) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });
  return data.Page.media;
}

export async function getAnimePageRandom(page: number, perPage = 20): Promise<AnimeMedia[]> {
  const data = await query<{ Page: { media: AnimeMedia[] } }>(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC, isAdult: false, episodes_greater: 1) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage });
  return data.Page.media;
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

// Anivexa's full provider roster (see docs at lvrcdn2.rewcrew.lv/docs).
// Shared between the stream-resolving route and the episode-availability
// route so the two can't drift out of sync.
export const ANIVA_PROVIDER_SLUGS = [
  'mkissa', 'reanime', 'anikoto', 'animegg', 'anineko', 'anidbapp',
  '2dhive', 'animenosub', 'anizone', 'anibd', 'senshi', 'kaa', 'animedunya',
] as const;

export type AnivaProvider = typeof ANIVA_PROVIDER_SLUGS[number];
export const ANIVA_PROVIDER_SET = new Set<string>(ANIVA_PROVIDER_SLUGS);

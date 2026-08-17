import { auth } from '@/lib/auth';
import { ANIVA_PROVIDER_SLUGS } from '@/lib/aniva-providers';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.ANIVA_API_BASE;

// Tells the client which providers actually have sub/dub for which episode
// numbers, straight from Anivexa's own episode listings — instead of
// blind-probing every provider x sub|dub combo (most of which don't exist),
// only resolve the combos we already know are real. Some providers (e.g.
// AnimeDunya) still answer a "dub" stream request even when they have zero
// dub episodes listed — the underlying video turns out to just be the JP
// sub track again — so trusting the episode list instead of the watch
// response is what keeps a fake dub button from showing up at all.
type ProviderEntry = { episodes?: { sub?: { number: number }[]; dub?: { number: number }[] }; error?: string };
type EpisodesResponse = Record<string, ProviderEntry>;

type Availability = Record<string, { sub: number[]; dub: number[] }>;

type CacheEntry = { data: Availability; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000;

function cacheGet(key: string): Availability | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!BASE) return NextResponse.json({ error: 'Aniva nav konfigurēts' }, { status: 500 });

  const anilistId = req.nextUrl.searchParams.get('anilist_id');
  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });

  const cached = cacheGet(anilistId);
  if (cached) return NextResponse.json(cached);

  let data: EpisodesResponse;
  try {
    const res = await fetchWithTimeout(`${BASE}/episodes/${anilistId}`, {}, 10000);
    if (!res.ok) return NextResponse.json({ error: 'Epizodes nav pieejamas' }, { status: 404 });
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt epizodes' }, { status: 502 });
  }

  const availability: Availability = {};
  for (const slug of ANIVA_PROVIDER_SLUGS) {
    const episodes = data[slug]?.episodes;
    availability[slug] = {
      sub: (episodes?.sub ?? []).map(e => e.number),
      dub: (episodes?.dub ?? []).map(e => e.number),
    };
  }

  cache.set(anilistId, { data: availability, ts: Date.now() });
  return NextResponse.json(availability);
}

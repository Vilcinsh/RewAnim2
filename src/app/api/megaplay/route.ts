import { auth } from '@/lib/auth';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://megaplay.buzz';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

// MegaPlay's own embed player, used directly via iframe — not scraped or
// decrypted. Their getSources response returns an AES-encrypted "enc" blob
// (the same MegaCloud scheme HiAnime's embeds use) instead of a plain
// stream URL, and decrypting that ourselves would put us in the same
// position as the aniwatch-api project Crunchyroll DMCA'd. Embedding their
// public player is exactly what they document as the intended integration
// for third-party sites ("Your website isn't based on Aniwatch or
// HiAnime? No problem — you can still access our server videos by MAL or
// AniList using the endpoints above"), so their own infrastructure does the
// decryption, not ours.
//
// Not every anime/episode is mapped to an AniList id yet — an unmapped
// combo serves a disguised error page at HTTP 200 (their own "File not
// found" markup, class="error-container"), not a real error status, so the
// only way to know is to check the body before offering it as an option.
type CacheEntry = { ok: boolean; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000;

function cacheGet(key: string): boolean | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.ok;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const anilistId = searchParams.get('anilist_id');
  const ep = searchParams.get('ep') ?? '1';
  const lang = searchParams.get('lang') === 'dub' ? 'dub' : 'sub';

  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });

  const embedUrl = `${BASE}/stream/ani/${encodeURIComponent(anilistId)}/${encodeURIComponent(ep)}/${lang}`;
  const cacheKey = `${anilistId}:${ep}:${lang}`;

  const cached = cacheGet(cacheKey);
  if (cached === true) return NextResponse.json({ streamUrl: embedUrl, subtitleUrl: null, streamType: 'iframe' });
  if (cached === false) return NextResponse.json({ error: 'Nav pieejams' }, { status: 404 });

  try {
    const res = await fetchWithTimeout(embedUrl, { headers: { 'User-Agent': UA, Referer: `${BASE}/` } }, 10000);
    const html = await res.text();
    const ok = res.ok && !html.includes('error-container');
    cache.set(cacheKey, { ok, ts: Date.now() });
    if (!ok) return NextResponse.json({ error: 'Nav pieejams' }, { status: 404 });
    return NextResponse.json({ streamUrl: embedUrl, subtitleUrl: null, streamType: 'iframe' });
  } catch {
    return NextResponse.json({ error: 'Nevar pārbaudīt' }, { status: 502 });
  }
}

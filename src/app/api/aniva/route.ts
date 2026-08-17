import { auth } from '@/lib/auth';
import { ANIVA_PROVIDER_SET, type AnivaProvider } from '@/lib/aniva-providers';
import { isAllowedCdnHost } from '@/lib/cdn-hosts';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.ANIVA_API_BASE;

// Anivexa's 13 providers all live behind one API but return wildly different
// JSON shapes for /watch — most use a `streams[]` array of {url, type, ...},
// but mkissa returns `sources[]` where the playable link is buried in
// extractedUrl/extractedType (the raw `url` is an allanime clock.json blob
// that needs further decryption we don't do). Providers that only ever
// return `type: "embed"` (2dhive, animenosub) have no direct HLS/mp4 link at
// all and are naturally filtered out below rather than special-cased.

type RawSubtitle = { url?: string; file?: string; label?: string; language?: string; srclang?: string; default?: boolean };
type RawStream = {
  url?: string;
  type?: string;
  server?: string;
  referer?: string;
  headers?: { Referer?: string };
  subtitles?: RawSubtitle[];
  priority?: number;
  isActive?: boolean;
};
type RawSource = {
  url?: string;
  extractedUrl?: string | null;
  extractedType?: string | null;
  priority?: number;
  headers?: { Referer?: string };
};
type WatchResponse = {
  error?: string;
  streams?: RawStream[];
  sources?: RawSource[];
};

type Candidate = {
  url: string;
  type: 'hls' | 'mp4';
  referer?: string;
  subtitles?: RawSubtitle[];
  priority: number;
  isActive: boolean;
};

// Short-lived cache purely to dedupe rapid double-fetches (e.g. React
// StrictMode) — NOT a performance cache. Upstream HLS tokens can expire
// within minutes, so anything longer risks handing out dead links.
type CacheEntry = { streamUrl: string; subtitleUrl: string | null; streamType: 'hls' | 'mp4'; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000;

function cacheGet(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry;
}

function isProxyableUrl(url: string): boolean {
  try { return isAllowedCdnHost(new URL(url).hostname); }
  catch { return false; }
}

function normalizeCandidates(data: WatchResponse): Candidate[] {
  if (Array.isArray(data.sources)) {
    // mkissa: only entries where the API already extracted a playable link.
    return data.sources
      .filter((s): s is RawSource & { extractedUrl: string; extractedType: string } =>
        !!s.extractedUrl && (s.extractedType === 'hls' || s.extractedType === 'direct') && isProxyableUrl(s.extractedUrl))
      .map(s => ({
        url: s.extractedUrl,
        type: s.extractedType === 'hls' ? 'hls' as const : 'mp4' as const,
        referer: s.headers?.Referer,
        priority: s.priority ?? 0,
        isActive: true,
      }));
  }

  if (Array.isArray(data.streams)) {
    return data.streams
      .filter((s): s is RawStream & { url: string } =>
        !!s.url && (s.type === 'hls' || s.type === 'mp4') && isProxyableUrl(s.url))
      .map(s => ({
        url: s.url,
        type: s.type as 'hls' | 'mp4',
        referer: s.referer ?? s.headers?.Referer,
        subtitles: s.subtitles,
        priority: s.priority ?? 0,
        isActive: s.isActive ?? false,
      }));
  }

  return [];
}

function isManifest(contentType: string, url: string): boolean {
  return contentType.includes('mpegurl') || url.endsWith('.m3u8');
}

function firstManifestRef(body: string, manifestUrl: string): string | null {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    try { return new URL(line, manifestUrl).toString(); } catch { continue; }
  }
  return null;
}

// A master playlist being reachable proves nothing — the segments it points
// at can live on a dead host. Follows master -> variant -> first segment to
// confirm the bytes are actually servable before handing the stream out.
async function isReachable(url: string, referer: string, depth = 0): Promise<boolean> {
  if (depth > 3) return true;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Referer: referer, Range: 'bytes=0-2047' },
    }, 3000);
    if (!res.ok && res.status !== 206) return false;
    if (!isManifest(res.headers.get('content-type') ?? '', url)) return true;
    const next = firstManifestRef(await res.text(), res.url || url);
    if (!next || next === url) return true;
    return isReachable(next, referer, depth + 1);
  } catch {
    return false;
  }
}

// Checks every hls candidate's reachability concurrently instead of one at
// a time — a provider like mkissa can hand back several dead mirrors before
// a working one, and probing them sequentially means paying each one's
// timeout in full before trying the next. Priority order is still honored:
// this only changes how the checks run, not which candidate wins.
async function pickCandidate(candidates: Candidate[]): Promise<Candidate | null> {
  const ordered = [
    ...candidates.filter(c => c.isActive),
    ...candidates.filter(c => !c.isActive).sort((a, b) => b.priority - a.priority),
  ];

  const hlsCandidates = ordered.filter(c => c.type === 'hls');
  const reachableFlags = await Promise.all(
    hlsCandidates.map(c => isReachable(c.url, c.referer ?? `${BASE}/`))
  );
  const reachableUrls = new Set(hlsCandidates.filter((_, i) => reachableFlags[i]).map(c => c.url));

  return ordered.find(c => c.type === 'mp4' || reachableUrls.has(c.url)) ?? null;
}

function pickSubtitle(subtitles: RawSubtitle[] | undefined): RawSubtitle | null {
  const usable = (subtitles ?? []).filter(s => {
    const url = s.url ?? s.file;
    if (!url || !isProxyableUrl(url)) return false;
    return url.endsWith('.vtt') || url.endsWith('.srt');
  });
  if (!usable.length) return null;
  return usable.find(s => s.default) ?? usable[0];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!BASE) return NextResponse.json({ error: 'Aniva nav konfigurēts' }, { status: 500 });

  const { searchParams } = req.nextUrl;
  const anilistId = searchParams.get('anilist_id');
  const ep = Number(searchParams.get('ep') ?? '1');
  const lang = searchParams.get('lang') === 'dub' ? 'dub' : 'sub';
  const providerParam = searchParams.get('provider') as AnivaProvider | null;

  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });
  if (!providerParam || !ANIVA_PROVIDER_SET.has(providerParam)) {
    return NextResponse.json({ error: 'Nezināms provider' }, { status: 400 });
  }
  const provider = providerParam;

  const cacheKey = `${provider}:${anilistId}:${ep}:${lang}`;
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ streamUrl: cached.streamUrl, subtitleUrl: cached.subtitleUrl, streamType: cached.streamType });

  let data: WatchResponse;
  try {
    const res = await fetchWithTimeout(`${BASE}/watch/${provider}/${anilistId}/${lang}/${provider}-${ep}`, {}, 10000);
    if (!res.ok) return NextResponse.json({ error: 'Straume nav pieejama' }, { status: 404 });
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt straumi' }, { status: 502 });
  }

  if (data.error) return NextResponse.json({ error: data.error }, { status: 404 });

  const candidates = normalizeCandidates(data);
  const stream = await pickCandidate(candidates);
  if (!stream) return NextResponse.json({ error: 'Nav video avots' }, { status: 404 });

  const referer = stream.referer ?? `${BASE}/`;
  const streamUrl = `/api/stream-proxy?${new URLSearchParams({ url: stream.url, referer }).toString()}`;

  const subtitle = pickSubtitle(stream.subtitles);
  const subUrl = subtitle ? (subtitle.url ?? subtitle.file) : null;
  const subtitleUrl = subUrl ? `/api/subtitle-proxy?${new URLSearchParams({ url: subUrl }).toString()}` : null;

  cache.set(cacheKey, { streamUrl, subtitleUrl, streamType: stream.type, ts: Date.now() });

  return NextResponse.json({ streamUrl, subtitleUrl, streamType: stream.type });
}

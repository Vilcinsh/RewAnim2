import { auth } from '@/lib/auth';
import { isAllowedCdnHost } from '@/lib/cdn-hosts';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.MIRURO_API_BASE;

// Providers checked so far: kiwi (animepahe, HLS+AES — ships HEVC, which
// Chrome/Firefox can't decode via MSE, dead end) and ally (allanime). ally's
// mp4upload.com direct file is also a dead end — it 403s even from a plain
// curl with correct Referer, meaning it's bound to whatever session/IP
// originally requested it (Miruro's backend), not fixable from our side.
// Its HLS option ("Uni" server) is what we're using instead, though that
// link has also been observed dead-on-arrival (410 straight from origin)
// for some episodes — bonk (vivibebe.site) verified as a working HLS
// fallback for those cases. hop/pewe/bee/SENSHI still unverified/dead.
const ALLOWED_PROVIDERS = new Set(['kiwi', 'ally', 'bonk']);
const DEFAULT_PROVIDER = 'ally';

type EpisodesResponse = {
  providers?: Record<string, {
    episodes?: Record<string, Array<{ id: string; number: number }>>;
  }>;
};

type MiruroStream = {
  url: string;
  type: string;
  isActive?: boolean;
  referer?: string;
  resolution?: { width: number; height: number };
};

type MiruroSubtitle = {
  file: string;
  label?: string;
  kind?: string;
  default?: boolean;
  language?: string;
};

type WatchResponse = {
  streams?: MiruroStream[];
  subtitles?: MiruroSubtitle[];
};

// Short-lived cache purely to dedupe rapid double-fetches (e.g. React
// StrictMode) — NOT a performance cache. allanime's HLS tokens appear to
// expire within seconds, so anything longer would hand out dead links.
type CacheEntry = { streamUrl: string; subtitleUrl: string | null; streamType: string; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 1000;

function cacheGet(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry;
}

function isProxyable(stream: MiruroStream): boolean {
  try { return isAllowedCdnHost(new URL(stream.url).hostname); }
  catch { return false; }
}

function isManifest(contentType: string, url: string): boolean {
  return contentType.includes('mpegurl') || url.endsWith('.m3u8');
}

// Finds the first segment/playlist reference in an HLS manifest body.
function firstManifestRef(body: string, manifestUrl: string): string | null {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    try { return new URL(line, manifestUrl).toString(); } catch { continue; }
  }
  return null;
}

// A master playlist being reachable proves nothing — the actual segments it
// points at can live on a different, dead host (expired token, or a CDN the
// viewer's own DNS/ad-blocker sinkholes). So this follows master → variant
// playlist → first segment, actually confirming the bytes are servable
// before handing the stream to the player. Range caps how much of a real
// segment gets downloaded just to probe it.
async function isReachable(url: string, referer: string, depth = 0): Promise<boolean> {
  if (depth > 3) return true;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Referer: referer, Range: 'bytes=0-2047' },
    }, 5000);
    if (!res.ok && res.status !== 206) return false;
    if (!isManifest(res.headers.get('content-type') ?? '', url)) return true;
    const next = firstManifestRef(await res.text(), res.url || url);
    if (!next || next === url) return true;
    return isReachable(next, referer, depth + 1);
  } catch {
    return false;
  }
}

// Only bonk has surfaced a subtitles array so far (English captions,
// including for its dub — useful since a dub track's captions are the
// actual dialogue, not a translation of it). Player already treats
// subtitles as optional/toggleable, so just pick the upstream default.
function pickSubtitle(subtitles: MiruroSubtitle[] | undefined): MiruroSubtitle | null {
  const captions = (subtitles ?? []).filter(s => {
    try { return isAllowedCdnHost(new URL(s.file).hostname); }
    catch { return false; }
  });
  if (!captions.length) return null;
  return captions.find(s => s.default) ?? captions[0];
}

// Providers mark multiple mirrors "isActive" at once, and that flag says
// nothing about whether the mirror actually works right now — so instead of
// trusting it, probe each candidate end-to-end and return the first live one.
async function pickStream(streams: MiruroStream[] | undefined): Promise<MiruroStream | null> {
  const hls = (streams ?? []).filter(s => s.type === 'hls' && isProxyable(s));
  if (!hls.length) return null;

  const ordered = [
    ...hls.filter(s => s.isActive),
    ...hls.filter(s => !s.isActive).sort((a, b) => (b.resolution?.width ?? 0) - (a.resolution?.width ?? 0)),
  ];

  for (const candidate of ordered) {
    if (await isReachable(candidate.url, candidate.referer ?? `${BASE}/`)) return candidate;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!BASE) return NextResponse.json({ error: 'Miruro nav konfigurēts' }, { status: 500 });

  const { searchParams } = req.nextUrl;
  const anilistId = searchParams.get('anilist_id');
  const ep = Number(searchParams.get('ep') ?? '1');
  const lang = searchParams.get('lang') === 'dub' ? 'dub' : 'sub';
  const providerParam = searchParams.get('provider') ?? DEFAULT_PROVIDER;
  const provider = ALLOWED_PROVIDERS.has(providerParam) ? providerParam : DEFAULT_PROVIDER;

  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });

  const cacheKey = `${provider}:${anilistId}:${ep}:${lang}`;
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ streamUrl: cached.streamUrl, subtitleUrl: cached.subtitleUrl, streamType: cached.streamType });

  let episodeId: string | undefined;
  try {
    const episodesRes = await fetchWithTimeout(`${BASE}/episodes/${encodeURIComponent(anilistId)}`);
    if (!episodesRes.ok) return NextResponse.json({ error: 'Epizodes nav pieejamas' }, { status: 404 });
    const episodesData: EpisodesResponse = await episodesRes.json();
    const list = episodesData.providers?.[provider]?.episodes?.[lang] ?? [];
    episodeId = list.find(e => e.number === ep)?.id;
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt epizodes' }, { status: 502 });
  }

  if (!episodeId) return NextResponse.json({ error: 'Epizode nav atrasta' }, { status: 404 });

  let watchData: WatchResponse;
  try {
    const watchRes = await fetchWithTimeout(`${BASE}/${episodeId}`);
    if (!watchRes.ok) return NextResponse.json({ error: 'Straume nav pieejama' }, { status: 404 });
    watchData = await watchRes.json();
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt straumi' }, { status: 502 });
  }

  const stream = await pickStream(watchData.streams);
  if (!stream) return NextResponse.json({ error: 'Nav video avots' }, { status: 404 });

  const referer = stream.referer ?? `${BASE}/`;
  const streamUrl = `/api/stream-proxy?${new URLSearchParams({ url: stream.url, referer }).toString()}`;
  const streamType = 'hls';

  const subtitle = pickSubtitle(watchData.subtitles);
  const subtitleUrl = subtitle ? `/api/subtitle-proxy?${new URLSearchParams({ url: subtitle.file }).toString()}` : null;

  cache.set(cacheKey, { streamUrl, subtitleUrl, streamType, ts: Date.now() });

  return NextResponse.json({ streamUrl, subtitleUrl, streamType });
}

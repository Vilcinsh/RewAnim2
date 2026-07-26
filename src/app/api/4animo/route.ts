import { auth } from '@/lib/auth';
import { fetchWithTimeout } from '@/lib/fetch-timeout';
import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://cdn.4animo.xyz';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Referer': `${BASE}/`,
};

// --- In-memory cache (5 min TTL) ---
type CacheEntry = { streamUrl: string; subtitleUrl: string | null; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry;
}

// --- Discord alert when CDN structure changes ---
async function alertDiscord(msg: string) {
  if (!DISCORD_WEBHOOK) return;
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `🚨 **4animo CDN kļūda**\n\`\`\`\n${msg.slice(0, 1800)}\n\`\`\`` }),
    });
  } catch { /* ignore webhook errors */ }
}

// Finds the sources URL by content pattern, not by variable name.
// Resilient to variable renames.
function extractSourcesUrl(html: string): string | null {
  const match = html.match(/['"](\/?(?:stream\/)?getSources[^'"]{10,})['"]/);
  if (match) return match[1].startsWith('/') ? match[1] : `/${match[1]}`;

  for (const key of ['sourcesUrl', 'getSourcesUrl', 'streamUrl', 'sourceUrl']) {
    const idx = html.indexOf(key);
    if (idx === -1) continue;
    let i = idx + key.length;
    while (i < html.length && (html[i] === ' ' || html[i] === '\t' || html[i] === '=' || html[i] === ':')) i++;
    const quote = html[i];
    if (quote !== '"' && quote !== "'") continue;
    i++;
    const start = i;
    const end = html.indexOf(quote, start);
    if (end === -1) continue;
    const val = html.slice(start, end);
    if (val.includes('getSources') || val.includes('/stream/')) return val;
  }
  return null;
}

// Fetch embed HTML and extract sources URL, with retry on transient failures.
async function fetchEmbed(server: string, anilistId: string, ep: string, lang: string): Promise<string | null> {
  const url = `${BASE}/embed/${server}/ani/${anilistId}/${ep}/${lang}?k=1`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { headers: HEADERS });
      if (!res.ok) return null;
      const html = await res.text();
      const sourcesUrl = extractSourcesUrl(html);
      if (!sourcesUrl) {
        // Alert only on first attempt to avoid spam
        if (attempt === 0) {
          await alertDiscord(
            `extractSourcesUrl nav atrasts!\nServer: ${server}, id: ${anilistId}, ep: ${ep}, lang: ${lang}\n\nHTML snippet:\n${html.slice(0, 600)}`
          );
        }
        return null;
      }
      return sourcesUrl;
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 200));
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const anilistId = searchParams.get('anilist_id');
  const ep = searchParams.get('ep') ?? '1';
  const requestedServer = searchParams.get('server') === 'sd-1' ? 'sd-1' : 'hd-1';
  const lang = searchParams.get('lang') === 'dub' ? 'dub' : 'sub';

  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });

  // Check cache
  const cacheKey = `${anilistId}:${ep}:${lang}:${requestedServer}`;
  const cached = cacheGet(cacheKey);
  if (cached) return NextResponse.json({ streamUrl: cached.streamUrl, subtitleUrl: cached.subtitleUrl });

  // Server fallback (hd-1 <-> sd-1) is handled client-side, which probes
  // both servers in parallel — trying both here too would double the
  // wait on every request without improving success odds.
  const sourcesPath = await fetchEmbed(requestedServer, anilistId, ep, lang);
  const usedServer = requestedServer;

  if (!sourcesPath) {
    return NextResponse.json({ error: 'Embed nav pieejams' }, { status: 404 });
  }

  // Fetch actual stream sources
  let data: { sources?: Array<{ file: string; type?: string }>; tracks?: Array<{ file: string; kind?: string; directUrl?: string }> };
  try {
    const sourcesRes = await fetchWithTimeout(`${BASE}${sourcesPath}`, {
      headers: { ...HEADERS, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!sourcesRes.ok) return NextResponse.json({ error: 'Sources nav pieejams' }, { status: 404 });
    data = await sourcesRes.json();
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt sources' }, { status: 502 });
  }

  const video = data.sources?.find(s => s.type === 'hls') ?? data.sources?.[0];
  if (!video?.file) return NextResponse.json({ error: 'Nav video avots' }, { status: 404 });

  const rawStreamUrl = video.file.startsWith('http') ? video.file : `${BASE}${video.file}`;
  const streamUrl = `/api/stream-proxy?url=${encodeURIComponent(rawStreamUrl)}&referer=${encodeURIComponent(`${BASE}/`)}`;

  let subtitleUrl: string | null = null;
  const sub = data.tracks?.find(t => t.kind === 'captions' || t.kind === 'subtitles');
  if (sub) {
    const f = sub.directUrl ?? sub.file;
    const rawUrl = f?.startsWith('http') ? f : `${BASE}${f}`;
    subtitleUrl = `/api/subtitle-proxy?url=${encodeURIComponent(rawUrl)}`;
  }

  // Store in cache
  cache.set(cacheKey, { streamUrl, subtitleUrl, ts: Date.now() });

  return NextResponse.json({ streamUrl, subtitleUrl, server: usedServer });
}

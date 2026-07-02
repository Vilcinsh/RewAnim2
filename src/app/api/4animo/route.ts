import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://cdn.4animo.xyz';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Referer': `${BASE}/`,
};

function extractString(html: string, key: string): string | null {
  const idx = html.indexOf(key);
  if (idx === -1) return null;
  let i = idx + key.length;
  while (i < html.length && (html[i] === ' ' || html[i] === '\t' || html[i] === ':' || html[i] === '"')) {
    if (html[i] === '"') { i++; break; }
    i++;
  }
  const start = i;
  const end = html.indexOf('"', start);
  if (end === -1) return null;
  return html.slice(start, end);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const anilistId = searchParams.get('anilist_id');
  const ep = searchParams.get('ep') ?? '1';
  const server = searchParams.get('server') === 'sd-1' ? 'sd-1' : 'hd-1';
  const lang = searchParams.get('lang') === 'dub' ? 'dub' : 'sub';

  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });

  let getSourcesUrl: string;
  try {
    const embedRes = await fetch(`${BASE}/embed/${server}/ani/${anilistId}/${ep}/${lang}?k=1`, { headers: HEADERS });
    if (!embedRes.ok) return NextResponse.json({ error: 'Embed nav pieejams' }, { status: 404 });
    const html = await embedRes.text();
    const url = extractString(html, 'getSourcesUrl');
    if (!url) return NextResponse.json({ error: 'getSourcesUrl nav atrasts' }, { status: 404 });
    getSourcesUrl = url;
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt embed' }, { status: 502 });
  }

  let data: { sources?: Array<{ file: string; type?: string }>; tracks?: Array<{ file: string; kind?: string; directUrl?: string }> };
  try {
    const sourcesRes = await fetch(`${BASE}${getSourcesUrl}`, {
      headers: { ...HEADERS, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!sourcesRes.ok) return NextResponse.json({ error: 'Sources nav pieejams' }, { status: 404 });
    data = await sourcesRes.json();
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt sources' }, { status: 502 });
  }

  const video = data.sources?.find(s => s.type === 'hls') ?? data.sources?.[0];
  if (!video?.file) return NextResponse.json({ error: 'Nav video avots' }, { status: 404 });

  const streamUrl = video.file.startsWith('http') ? video.file : `${BASE}${video.file}`;

  let subtitleUrl: string | null = null;
  const sub = data.tracks?.find(t => t.kind === 'captions' || t.kind === 'subtitles');
  if (sub) {
    const f = sub.directUrl ?? sub.file;
    const rawUrl = f?.startsWith('http') ? f : `${BASE}${f}`;
    subtitleUrl = `/api/subtitle-proxy?url=${encodeURIComponent(rawUrl)}`;
  }

  return NextResponse.json({ streamUrl, subtitleUrl });
}

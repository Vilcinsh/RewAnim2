import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://cdn.4animo.xyz';

function extractArray(html: string, key: string): string | null {
  const patterns = [`"${key}":`, `${key}:`];
  let idx = -1;
  for (const p of patterns) {
    const found = html.indexOf(p);
    if (found !== -1) { idx = found; break; }
  }
  if (idx === -1) return null;
  const start = html.indexOf('[', idx);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  return null;
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

  let html: string;
  try {
    const res = await fetch(`${BASE}/embed/${server}/ani/${anilistId}/${ep}/${lang}?k=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': `${BASE}/`,
      },
    });
    if (!res.ok) return NextResponse.json({ error: 'Embed nav pieejams' }, { status: 404 });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: 'Nevar ielādēt embed' }, { status: 502 });
  }

  const sourcesJson = extractArray(html, 'sources');
  if (!sourcesJson) return NextResponse.json({ error: 'Nav atrasts sources' }, { status: 404 });

  let sources: Array<{ file: string; label?: string; type?: string }>;
  try { sources = JSON.parse(sourcesJson); }
  catch { return NextResponse.json({ error: 'Sources parsēšanas kļūda' }, { status: 500 }); }

  const video = sources.find(s => s.type === 'hls') ?? sources[0];
  if (!video?.file) return NextResponse.json({ error: 'Nav video avots' }, { status: 404 });

  const streamUrl = video.file.startsWith('http') ? video.file : `${BASE}${video.file}`;

  let subtitleUrl: string | null = null;
  const tracksJson = extractArray(html, 'tracks');
  if (tracksJson) {
    try {
      const tracks: Array<{ file: string; kind?: string }> = JSON.parse(tracksJson);
      const sub = tracks.find(t => t.kind === 'captions' || t.kind === 'subtitles');
      if (sub?.file) subtitleUrl = sub.file.startsWith('http') ? sub.file : `${BASE}${sub.file}`;
    } catch {}
  }

  return NextResponse.json({ streamUrl, subtitleUrl });
}

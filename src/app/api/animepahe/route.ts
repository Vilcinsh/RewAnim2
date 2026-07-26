import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.ANIMEPAHE_API_BASE;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!BASE) return NextResponse.json({ error: 'AnimePahe nav konfigurēts' }, { status: 500 });

  const { searchParams } = req.nextUrl;
  const anilistId = searchParams.get('anilist_id');
  const ep = searchParams.get('ep') ?? '1';
  const lang = searchParams.get('lang') === 'dub' ? 'dub' : 'sub';

  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });

  try {
    const res = await fetch(
      `${BASE}/api/megaplay/embed/al/${encodeURIComponent(anilistId)}/${ep}?lang=${lang}`
    );
    const data = await res.json();

    if (!data?.ok || !data?.embedUrl) {
      return NextResponse.json({ error: data?.error || 'Nav pieejams' }, { status: 404 });
    }

    return NextResponse.json({ embedUrl: data.embedUrl });
  } catch {
    return NextResponse.json({ error: 'AnimePahe API kļūda' }, { status: 502 });
  }
}

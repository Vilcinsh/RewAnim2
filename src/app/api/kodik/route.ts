import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.KODIK_API_BASE;

type RawTranslation = { id: number | string; title?: string; name?: string; type?: string };

// The upstream API hands back ids as strings ("3560") and Russian type
// labels ("Озвучка" / "Субтитры"). The player compares ids against the
// remembered voice (a number) and groups by 'voice' — so normalize here,
// otherwise the remembered voice never matches and every load falls back
// to the first team in the list.
function normalizeTranslations(list: RawTranslation[]) {
  const out: { id: number; title?: string; name?: string; type: 'voice' | 'subtitles' }[] = [];
  for (const t of list) {
    const id = Number(t.id);
    if (!Number.isFinite(id) || out.some(x => x.id === id)) continue;
    const type = (t.type ?? '').toLowerCase();
    const isSubs = type === 'subtitles' || type.startsWith('субтитр');
    out.push({ id, title: t.title, name: t.name, type: isSubs ? 'subtitles' : 'voice' });
  }
  return out;
}

async function requireAuth() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  if (!BASE) return NextResponse.json({ error: 'Kodik nav konfigurēts' }, { status: 500 });

  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action');
  const malId = searchParams.get('mal_id');

  if (!malId) return NextResponse.json({ error: 'Trūkst mal_id' }, { status: 400 });

  try {
    if (action === 'translations') {
      // Iegūt translāciju sarakstu caur info endpoint
      const res = await fetch(
        `${BASE}/kodik/info?anime_id=${malId}&id_type=shikimori`,
        { next: { revalidate: 600 } }
      );
      const data = await res.json();

      if (data?.success && data.info?.translations?.length) {
        return NextResponse.json({ translations: normalizeTranslations(data.info.translations) });
      }

      // Fallback uz search-by-id
      const res2 = await fetch(
        `${BASE}/kodik/search-by-id?anime_id=${malId}&id_type=shikimori`,
        { next: { revalidate: 600 } }
      );
      const data2 = await res2.json();
      if (data2?.success && data2.results?.length) {
        const translations = normalizeTranslations(
          data2.results
            .map((r: { translation?: RawTranslation }) => r.translation)
            .filter(Boolean)
        );
        return NextResponse.json({ translations });
      }

      return NextResponse.json({ translations: [] });
    }

    if (action === 'stream') {
      const ep = searchParams.get('ep') ?? '1';
      const tid = searchParams.get('tid');
      const quality = searchParams.get('quality') ?? '720';

      if (!tid) return NextResponse.json({ error: 'Trūkst translation_id' }, { status: 400 });

      const res = await fetch(
        `${BASE}/kodik/stream-url?anime_id=${malId}&id_type=shikimori&episode=${ep}&translation_id=${tid}&quality=${quality}`
      );
      const data = await res.json();

      if (data?.success && data.stream_url) {
        return NextResponse.json({ streamUrl: data.stream_url });
      }
      return NextResponse.json({ error: 'Stream URL nav atrasts' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Nezināms action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Kodik API kļūda' }, { status: 502 });
  }
}

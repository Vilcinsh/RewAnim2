import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const anilistId = searchParams.get('anilist_id');
  const ep = searchParams.get('ep') ?? '1';
  const lang = searchParams.get('lang') === 'dub' ? 'dub' : 'sub';

  if (!anilistId) return NextResponse.json({ error: 'Trūkst anilist_id' }, { status: 400 });

  const embedUrl = `https://cdn.4animo.xyz/embed/hd-2/ani/${anilistId}/${ep}/${lang}?k=1&autoPlay=1&skipIntro=0&skipOutro=0`;
  return NextResponse.json({ embedUrl });
}

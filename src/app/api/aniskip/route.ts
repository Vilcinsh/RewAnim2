import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const malId = searchParams.get('mal_id');
  const ep = searchParams.get('ep');

  if (!malId || !ep) return NextResponse.json({ intro: null, outro: null });

  try {
    const res = await fetch(
      `https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types=op&types=ed&episodeLength=0`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();

    if (!data.found || !data.results?.length) {
      return NextResponse.json({ intro: null, outro: null });
    }

    let intro = null, outro = null;
    for (const r of data.results) {
      const range = {
        start: Math.floor(r.interval.startTime),
        end: Math.floor(r.interval.endTime),
      };
      if (r.skipType === 'op') intro = range;
      if (r.skipType === 'ed') outro = range;
    }
    return NextResponse.json({ intro, outro });
  } catch {
    return NextResponse.json({ intro: null, outro: null });
  }
}

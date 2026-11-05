import { auth } from '@/lib/auth';
import { createRoom, isSource } from '@/lib/party';
import { NextResponse } from 'next/server';

// Create a watch party. The caller becomes the host.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const animeId = Number(body?.animeId);
  const ep = Number(body?.ep);
  if (!Number.isInteger(animeId) || !Number.isInteger(ep) || ep < 1 || !isSource(body?.source)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const id = createRoom({
    hostId: session.user.id,
    animeId,
    ep,
    source: body.source,
    position: Number(body?.position) || 0,
    playing: !!body?.playing,
  });
  return NextResponse.json({ id });
}

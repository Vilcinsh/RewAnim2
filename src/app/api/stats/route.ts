import { auth } from '@/lib/auth';
import { getWeeklyTopWatchers, getWeeklyTopAnime, getOthersWatching } from '@/lib/db-progress';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.user.id);
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'all';

  if (type === 'others') {
    const items = getOthersWatching(userId, 20);
    return NextResponse.json({ items });
  }
  const topWatchers = getWeeklyTopWatchers(10);
  const topAnime = getWeeklyTopAnime(20);
  const others = getOthersWatching(userId, 20);
  return NextResponse.json({ topWatchers, topAnime, others });
}

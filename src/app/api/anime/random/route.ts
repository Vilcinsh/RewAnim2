import { auth } from '@/lib/auth';
import { getAnimePageRandom } from '@/lib/anilist';
import { getWatchedAnimeIds } from '@/lib/db-progress';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.user.id);
  const watchedIds = new Set(getWatchedAnimeIds(userId));

  for (let attempt = 0; attempt < 5; attempt++) {
    const page = Math.floor(Math.random() * 150) + 1;
    try {
      const anime = await getAnimePageRandom(page, 20);
      const unwatched = anime.filter(a => !watchedIds.has(a.id));
      if (unwatched.length > 0) {
        const pick = unwatched[Math.floor(Math.random() * unwatched.length)];
        return NextResponse.json({ id: pick.id });
      }
    } catch {
      // try again
    }
  }
  return NextResponse.json({ error: 'Could not find random anime' }, { status: 500 });
}

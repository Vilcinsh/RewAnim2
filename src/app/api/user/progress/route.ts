import { auth } from '@/lib/auth';
import {
  upsertProgress, getWatchedEpisodes,
  getContinueWatching, getWatchHistory, getUserStats,
} from '@/lib/db-progress';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.user.id);
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const animeId = searchParams.get('anime_id');

  if (animeId) {
    const watched = getWatchedEpisodes(userId, Number(animeId));
    return NextResponse.json({ watched });
  }
  if (type === 'continue') {
    const items = getContinueWatching(userId, 20);
    return NextResponse.json({ items });
  }
  if (type === 'history') {
    const items = getWatchHistory(userId, 50);
    const stats = getUserStats(userId);
    return NextResponse.json({ items, stats });
  }
  return NextResponse.json({ error: 'Missing params' }, { status: 400 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.user.id);
  const body = await req.json();
  const { anime_id, anime_title, cover_image, episode, watched_seconds, duration_seconds, genres } = body;
  if (!anime_id || !episode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  upsertProgress(
    userId,
    Number(anime_id),
    String(anime_title ?? ''),
    String(cover_image ?? ''),
    Number(episode),
    Math.floor(Number(watched_seconds ?? 0)),
    Math.floor(Number(duration_seconds ?? 0)),
    Array.isArray(genres) ? genres : [],
  );
  return NextResponse.json({ ok: true });
}

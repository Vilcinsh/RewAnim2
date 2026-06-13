import { auth } from '@/lib/auth';
import { addWatchlist, removeWatchlist, getWatchlist, isWatchlisted } from '@/lib/db-progress';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.user.id);
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get('anime_id');
  if (animeId) {
    return NextResponse.json({ saved: isWatchlisted(userId, Number(animeId)) });
  }
  const items = getWatchlist(userId);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.user.id);
  const { anime_id, anime_title, cover_image } = await req.json();
  if (!anime_id) return NextResponse.json({ error: 'Missing anime_id' }, { status: 400 });
  addWatchlist(userId, Number(anime_id), String(anime_title ?? ''), String(cover_image ?? ''));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = Number(session.user.id);
  const { searchParams } = new URL(req.url);
  const animeId = searchParams.get('anime_id');
  if (!animeId) return NextResponse.json({ error: 'Missing anime_id' }, { status: 400 });
  removeWatchlist(userId, Number(animeId));
  return NextResponse.json({ ok: true });
}

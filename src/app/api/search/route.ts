import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { searchAnime } from '@/lib/anilist';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q');
  if (!q?.trim()) return NextResponse.json({ results: [] });

  try {
    const results = await searchAnime(q.trim(), 1, 7);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

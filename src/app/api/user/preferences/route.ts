import { auth } from '@/lib/auth';
import { getPreferences, setPreferences } from '@/lib/db-progress';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const prefs = getPreferences(Number(session.user.id));
  return NextResponse.json(prefs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  setPreferences(Number(session.user.id), {
    language: body.language,
    autoSkip: body.autoSkip,
    autoPlay: body.autoPlay,
  });
  return NextResponse.json({ ok: true });
}

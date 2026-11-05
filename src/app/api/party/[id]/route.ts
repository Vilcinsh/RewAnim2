import { auth } from '@/lib/auth';
import { applyAction, getRoom, type PartyAction } from '@/lib/party';
import { NextResponse } from 'next/server';

// Every party action (host controls, buffering reports, chat, reactions).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

  const action = (await req.json().catch(() => null)) as PartyAction | null;
  if (!action || typeof action.type !== 'string') return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const result = applyAction(room, session.user.id, action);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}

import { auth } from '@/lib/auth';
import { getAllUsers, createUser, deleteUser, updateUserPassword } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const users = getAllUsers();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { username, password, role } = body;

  if (!username || !password) {
    return NextResponse.json({ error: 'Trūkst lietotājvārds vai parole' }, { status: 400 });
  }

  try {
    const user = createUser(username, password, role ?? 'user');
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Lietotājvārds jau eksistē' }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, password } = await req.json();
  if (!id || !password) return NextResponse.json({ error: 'Nav ID vai parole' }, { status: 400 });

  updateUserPassword(Number(id), password);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Nav ID' }, { status: 400 });

  deleteUser(Number(id));
  return NextResponse.json({ ok: true });
}

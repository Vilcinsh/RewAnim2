import { auth } from '@/lib/auth';
import { getRoom, joinRoom } from '@/lib/party';
import { NextResponse } from 'next/server';

const PING_MS = 15_000;

// Server-Sent Events stream for one party. Being connected here is what
// makes someone a member — the member list is just the open connections.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const room = getRoom(id);
  if (!room) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

  const user = { id: session.user.id, name: session.user.name ?? 'Guest' };
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(chunk)); } catch { cleanup(); }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      const leave = joinRoom(room, user, {
        send: (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        close: () => cleanup(),
      });
      // Keeps proxies from timing the connection out.
      const ping = setInterval(() => write(`: ping\n\n`), PING_MS);

      cleanup = () => {
        clearInterval(ping);
        leave();
        close();
      };
      req.signal.addEventListener('abort', () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform also stops Next's gzip from buffering the stream.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

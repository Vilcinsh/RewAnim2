import { auth } from '@/lib/auth';
import { isAllowedCdnHost } from '@/lib/cdn-hosts';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  let target: URL;
  try { target = new URL(url); }
  catch { return new NextResponse('Invalid url', { status: 400 }); }

  // Only allow known 4animo-backed CDNs
  if (!isAllowedCdnHost(target.hostname)) {
    return new NextResponse('Not allowed', { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': 'https://cdn.4animo.xyz/',
      },
    });
    if (!res.ok) return new NextResponse('Upstream error', { status: res.status });

    const body = await res.text();

    // Convert SRT to WebVTT if needed
    const contentType = res.headers.get('content-type') ?? '';
    let vtt = body;
    if (!body.trimStart().startsWith('WEBVTT') && !contentType.includes('vtt')) {
      vtt = 'WEBVTT\n\n' + body
        .replace(/\r\n/g, '\n')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }

    return new NextResponse(vtt, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Fetch failed', { status: 502 });
  }
}

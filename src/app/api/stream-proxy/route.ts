import { auth } from '@/lib/auth';
import { isAllowedCdnHost } from '@/lib/cdn-hosts';
import { NextRequest, NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const DEFAULT_REFERER = 'https://cdn.4animo.xyz/';

function proxied(absoluteUrl: string, referer: string): string {
  return `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}`;
}

function isManifest(contentType: string, pathname: string): boolean {
  return contentType.includes('mpegurl') || pathname.endsWith('.m3u8');
}

// Rewrites every segment/playlist reference (and URI="..." attributes) in an
// HLS manifest to go back through this proxy, so the CDN's Referer check
// never sees a request that didn't originate from the server. Segments live
// on the same CDN as the manifest, so they need the same Referer forwarded.
function rewriteManifest(body: string, manifestUrl: string, referer: string): string {
  return body
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_m, uri) => {
          const abs = new URL(uri, manifestUrl).toString();
          return `URI="${proxied(abs, referer)}"`;
        });
      }

      const abs = new URL(trimmed, manifestUrl).toString();
      return proxied(abs, referer);
    })
    .join('\n');
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  let target: URL;
  try { target = new URL(url); }
  catch { return new NextResponse('Invalid url', { status: 400 }); }

  // Only allow known backing CDNs
  if (!isAllowedCdnHost(target.hostname)) {
    return new NextResponse('Not allowed', { status: 403 });
  }

  // Each provider (4animo, Miruro's per-episode providers, ...) requires its
  // own Referer for hotlink protection — the route that generated this URL
  // knows which one, so it's passed through rather than hardcoded here.
  const referer = req.nextUrl.searchParams.get('referer') || DEFAULT_REFERER;
  let refererOrigin = referer;
  try { refererOrigin = new URL(referer).origin; } catch { /* keep raw value */ }

  // Some CDNs (e.g. the ones behind kwik.cx) also check Origin and the
  // Sec-Fetch-* triplet a real cross-site <video>/hls.js request would
  // carry — Referer alone wasn't enough for their segment files. Node's
  // fetch isn't a browser, so unlike client-side JS it's free to set these.
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Referer': referer,
    'Origin': refererOrigin,
    'Accept': '*/*',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
  };
  // Some hosts (mp4upload) bind the file URL to a session cookie obtained
  // by loading their embed page first — passed through from the route that
  // fetched it, since this proxy has no reason to visit the embed itself.
  const cookie = req.nextUrl.searchParams.get('cookie');
  if (cookie) headers['Cookie'] = cookie;
  const range = req.headers.get('range');
  if (range) headers['Range'] = range;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: controller.signal });
  } catch {
    return new NextResponse('Fetch failed', { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) return new NextResponse('Upstream error', { status: res.status });

  const contentType = res.headers.get('content-type') ?? '';

  if (isManifest(contentType, target.pathname)) {
    const body = await res.text();
    const rewritten = rewriteManifest(body, res.url || url, referer);
    return new NextResponse(rewritten, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  }

  // Stream segments straight through instead of buffering the whole file —
  // buffering added a full extra download-then-upload delay to every segment.
  const outHeaders: Record<string, string> = {
    'Content-Type': contentType || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60',
  };
  const contentRange = res.headers.get('content-range');
  if (contentRange) outHeaders['Content-Range'] = contentRange;
  const acceptRanges = res.headers.get('accept-ranges');
  if (acceptRanges) outHeaders['Accept-Ranges'] = acceptRanges;
  // Deliberately not forwarding upstream's Content-Length: fetch() silently
  // decompresses gzip/br bodies without correcting that header, so the
  // stale (pre-decompression) byte count would tell the browser to expect
  // fewer bytes than we actually stream — truncating the encryption key and
  // segment files, which decrypt to garbage that fails to buffer as video.
  // Letting the runtime chunk the response instead avoids that mismatch.

  return new NextResponse(res.body, { status: res.status, headers: outHeaders });
}

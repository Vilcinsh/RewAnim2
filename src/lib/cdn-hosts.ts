// SSRF guard for the stream/subtitle proxies. Backing CDNs (4animo's embed
// pages, Miruro's per-provider hosts) hand out URLs on a shifting set of
// domains — and some providers (e.g. allanime's "Uni" HLS servers) point
// straight at rotating edge IPs with no stable domain at all. A closed
// domain allow-list can't keep up with that, so instead of listing known-good
// hosts we block known-bad address space (loopback/private/link-local) and
// let everything else through. `new URL()` already canonicalizes obfuscated
// IPv4 literals (hex/octal/decimal) before this ever sees them.
const BLOCKED_HOSTNAMES = new Set(['localhost']);
const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal'];

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // multicast (224.0.0.0/4) + reserved (240.0.0.0/4)
  return false;
}

function isBlockedIPv6(hostname: string): boolean {
  const addr = hostname.slice(1, -1).toLowerCase(); // strip [ ]
  if (addr === '::' || addr === '::1') return true; // unspecified / loopback
  if (addr.startsWith('fe80:') || /^fe[89ab][0-9a-f]:/.test(addr)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true; // unique local fc00::/7

  // IPv4-mapped (::ffff:a.b.c.d or its canonical hex form) — check the
  // embedded address too, since that's what the request actually reaches.
  const v4Mapped = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4Mapped) {
    const hi = parseInt(v4Mapped[1], 16);
    const lo = parseInt(v4Mapped[2], 16);
    const ip = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isBlockedIPv4(ip);
  }
  const v4Dotted = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Dotted) return isBlockedIPv4(v4Dotted[1]);

  return false;
}

export function isAllowedCdnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (BLOCKED_HOSTNAME_SUFFIXES.some(suffix => host.endsWith(suffix))) return false;

  if (host.startsWith('[') && host.endsWith(']')) return !isBlockedIPv6(host);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !isBlockedIPv4(host);

  return true;
}

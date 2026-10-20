// Server-side day boundaries and clock formatting. The site's audience is
// in Latvia, so server-rendered "today" uses Europe/Riga.

export const SITE_TZ = 'Europe/Riga';

function tzOffsetSeconds(unix: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(unix * 1000));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round(asUtc / 1000 - unix);
}

/** [start, end) of the calendar day containing `unix` in `tz`, as unix seconds. */
export function dayBounds(unix: number, tz = SITE_TZ): [number, number] {
  const off = tzOffsetSeconds(unix, tz);
  const start = Math.floor((unix + off) / 86400) * 86400 - off;
  return [start, start + 86400];
}

/** "14:30" in `tz`. */
export function formatClock(unix: number, tz = SITE_TZ): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(unix * 1000));
}

/** Current unix time in seconds (server components render once per request). */
export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/** "Oct 6" in `tz`. */
export function formatShortDate(unix: number, tz = SITE_TZ): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(new Date(unix * 1000));
}

/** "Tue, Oct 27" in `tz`. */
export function formatDayDate(unix: number, tz = SITE_TZ): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(unix * 1000));
}

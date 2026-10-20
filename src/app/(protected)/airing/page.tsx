import { auth } from '@/lib/auth';
import { getAiringSchedule, displayTitle } from '@/lib/anilist';
import { getWatchlist } from '@/lib/db-progress';
import { dayBounds, nowUnix } from '@/lib/time';
import ScheduleClient, { type ScheduleEntry } from '@/components/schedule/ScheduleClient';

function seasonLabel(unix: number) {
  const d = new Date(unix * 1000);
  const m = d.getUTCMonth();
  const name = m < 3 ? 'Winter' : m < 6 ? 'Spring' : m < 9 ? 'Summer' : 'Fall';
  return `${name} ${d.getUTCFullYear()}`;
}

export default async function SchedulePage() {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;
  const now = nowUnix();

  // The current Mon–Sun week, padded half a day each side so any viewer
  // timezone's week is covered; the client groups by its own local days.
  const [todayStart] = dayBounds(now);
  const weekday = (new Date(todayStart * 1000 + 12 * 3600 * 1000).getUTCDay() + 6) % 7;
  const from = todayStart - weekday * 86400 - 43200;
  const to = from + 8 * 86400;

  const schedule = await getAiringSchedule(from, to);
  const inList = new Set(userId ? getWatchlist(userId).map(w => w.animeId) : []);

  const entries: ScheduleEntry[] = schedule.map(s => ({
    id: s.media.id,
    title: displayTitle(s.media),
    cover: s.media.coverImage.medium,
    color: s.media.coverImage.color,
    episode: s.episode,
    airingAt: s.airingAt,
    duration: 24,
    inList: inList.has(s.media.id),
  }));

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-6 px-4 pb-24 md:px-8 lg:pb-16"
      style={{ paddingTop: 'calc(var(--header-h) + 32px)' }}>
      <ScheduleClient entries={entries} season={seasonLabel(now)} />
    </div>
  );
}

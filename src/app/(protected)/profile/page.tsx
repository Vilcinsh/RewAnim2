import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getPreferences, getUserStats, getWatchHistory, getWatchlist, getUserTopGenres, getWeeklyTopWatchers, getEpisodeHighWater,
} from '@/lib/db-progress';
import { getAllUsers } from '@/lib/users';
import { getAnimeByIds, airedEpisodes, displayTitle } from '@/lib/anilist';
import { nowUnix } from '@/lib/time';
import ProfileClient, { type Tab, type WatchlistEntry } from './ProfileClient';

type Props = { searchParams: Promise<{ tab?: string }> };

const TABS: Tab[] = ['watchlist', 'history', 'settings'];
const NEW_WINDOW = 7 * 86400;

export default async function ProfilePage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { tab } = await searchParams;
  const userId = Number(session.user.id);
  const now = nowUnix();
  const prefs = getPreferences(userId);
  const stats = getUserStats(userId);
  const history = getWatchHistory(userId, 50);
  const watchlist = getWatchlist(userId);
  const topGenre = getUserTopGenres(userId, 1)[0] ?? null;
  const rankIdx = getWeeklyTopWatchers(100).findIndex(w => w.userId === userId);
  const createdAt = getAllUsers().find(u => u.id === userId)?.created_at ?? null;
  const highWater = getEpisodeHighWater(userId);

  // AniList data for progress / "new episode" state, in batches of 50.
  const ids = watchlist.map(w => w.animeId);
  const batches = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) => getAnimeByIds(ids.slice(i * 50, i * 50 + 50))));
  const media = new Map(batches.flat().map(m => [m.id, m]));

  // Status is derived from viewing progress until watchlist statuses exist in the DB.
  const entries: WatchlistEntry[] = watchlist.map(w => {
    const m = media.get(w.animeId);
    const hw = highWater.get(w.animeId);
    const aired = m ? airedEpisodes(m) ?? 0 : 0;
    const total = m?.episodes ?? null;
    const finished = hw?.finished ?? 0;
    const started = hw?.started ?? 0;
    const status: WatchlistEntry['status'] = !started ? 'planned'
      : total && finished >= total ? 'completed' : 'watching';
    const lastAiredAt = m?.nextAiringEpisode ? m.nextAiringEpisode.airingAt - 7 * 86400 : null;
    const newEp = status === 'watching' && aired > finished && lastAiredAt != null && now - lastAiredAt < NEW_WINDOW;
    const airedToday = newEp && lastAiredAt != null && now - lastAiredAt < 86400;
    return {
      animeId: w.animeId,
      title: m ? displayTitle(m) : w.animeTitle,
      cover: m?.coverImage.large ?? w.coverImage,
      color: m?.coverImage.color ?? null,
      addedAt: w.addedAt,
      status,
      watched: finished,
      aired,
      total,
      newEp,
      airedToday,
      nextEp: Math.min(finished + 1, Math.max(aired, 1)),
    };
  });

  return (
    <div className="mx-auto max-w-[1376px] px-4 pb-24 md:px-8 md:pb-16" style={{ paddingTop: 'calc(var(--header-h) + 32px)' }}>
      <ProfileClient
        username={session.user.name ?? 'User'}
        createdAt={createdAt}
        rank={rankIdx >= 0 ? rankIdx + 1 : null}
        topGenre={topGenre}
        prefs={prefs}
        stats={stats}
        history={history}
        watchlist={entries}
        tab={TABS.includes(tab as Tab) ? (tab as Tab) : 'watchlist'}
      />
    </div>
  );
}

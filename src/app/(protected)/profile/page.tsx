import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getPreferences, getUserStats, getWatchHistory, getWatchlist } from '@/lib/db-progress';
import ProfileClient from './ProfileClient';

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function ProfilePage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { tab } = await searchParams;
  const userId = Number(session.user.id);
  const prefs = getPreferences(userId);
  const stats = getUserStats(userId);
  const history = getWatchHistory(userId, 50);
  const watchlist = getWatchlist(userId);

  return (
    <div className="container mx-auto px-4 pt-20 pb-8 max-w-7xl">
      <ProfileClient
        username={session.user.name ?? 'User'}
        prefs={prefs}
        stats={stats}
        history={history}
        watchlist={watchlist}
        initialTab={(tab === 'watchlist' || tab === 'history' || tab === 'settings') ? tab : 'settings'}
      />
    </div>
  );
}

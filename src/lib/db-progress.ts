import getDb from './db';

export type UserPreferences = {
  language: 'ru' | 'en';
  autoSkip: boolean;
  autoPlay: boolean;
};

export type ContinueItem = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  episode: number;
  watchedSeconds: number;
  durationSeconds: number;
  updatedAt: string;
};

export type WatchlistItem = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  addedAt: string;
};

export type UserStats = {
  totalSeconds: number;
  animeCount: number;
  episodeCount: number;
};

export type HistoryItem = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  episodeCount: number;
  completedEpisodes: number;
  totalSeconds: number;
  lastWatched: string;
};

export type TopWatcher = {
  userId: number;
  username: string;
  totalSeconds: number;
  animeCount: number;
};

export type TopAnime = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  viewerCount: number;
};

export type OthersItem = {
  animeId: number;
  animeTitle: string;
  coverImage: string;
  viewerCount: number;
};

const DEFAULT_PREFS: UserPreferences = { language: 'ru', autoSkip: true, autoPlay: true };

export function getPreferences(userId: number): UserPreferences {
  const db = getDb();
  const row = db.prepare('SELECT language, auto_skip, auto_play FROM user_preferences WHERE user_id = ?').get(userId) as
    { language: string; auto_skip: number; auto_play: number } | undefined;
  if (!row) return DEFAULT_PREFS;
  return {
    language: (row.language as 'ru' | 'en') ?? 'ru',
    autoSkip: !!row.auto_skip,
    autoPlay: !!row.auto_play,
  };
}

export function setPreferences(userId: number, prefs: Partial<UserPreferences>): void {
  const db = getDb();
  const current = getPreferences(userId);
  const clean = Object.fromEntries(Object.entries(prefs).filter(([, v]) => v !== undefined)) as Partial<UserPreferences>;
  const merged = { ...current, ...clean };
  db.prepare(`
    INSERT INTO user_preferences (user_id, language, auto_skip, auto_play, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      language = excluded.language,
      auto_skip = excluded.auto_skip,
      auto_play = excluded.auto_play,
      updated_at = datetime('now')
  `).run(userId, merged.language, merged.autoSkip ? 1 : 0, merged.autoPlay ? 1 : 0);
}

export function upsertProgress(
  userId: number,
  animeId: number,
  animeTitle: string,
  coverImage: string,
  episode: number,
  watchedSeconds: number,
  durationSeconds: number,
  genres: string[],
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO watch_history
      (user_id, anime_id, anime_title, cover_image, episode, watched_seconds, duration_seconds, genres_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, anime_id, episode) DO UPDATE SET
      watched_seconds = excluded.watched_seconds,
      duration_seconds = excluded.duration_seconds,
      anime_title = excluded.anime_title,
      cover_image = excluded.cover_image,
      genres_json = excluded.genres_json,
      updated_at = datetime('now')
  `).run(userId, animeId, animeTitle, coverImage, episode, watchedSeconds, durationSeconds, JSON.stringify(genres));
}

export function getWatchedEpisodes(userId: number, animeId: number): number[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT episode FROM watch_history
    WHERE user_id = ? AND anime_id = ?
      AND duration_seconds > 0
      AND CAST(watched_seconds AS FLOAT) / duration_seconds >= 0.85
  `).all(userId, animeId) as { episode: number }[];
  return rows.map(r => r.episode);
}

export function getContinueWatching(userId: number, limit = 20): ContinueItem[] {
  const db = getDb();
  const rows = db.prepare(`
    WITH latest AS (
      SELECT anime_id, MAX(updated_at) as max_at
      FROM watch_history
      WHERE user_id = ?
        AND duration_seconds > 0
        AND CAST(watched_seconds AS FLOAT) / duration_seconds BETWEEN 0.03 AND 0.84
      GROUP BY anime_id
    )
    SELECT w.anime_id, w.anime_title, w.cover_image, w.episode,
      w.watched_seconds, w.duration_seconds, w.updated_at
    FROM watch_history w
    JOIN latest ON w.anime_id = latest.anime_id AND w.updated_at = latest.max_at
    WHERE w.user_id = ?
    ORDER BY w.updated_at DESC
    LIMIT ?
  `).all(userId, userId, limit) as {
    anime_id: number; anime_title: string; cover_image: string;
    episode: number; watched_seconds: number; duration_seconds: number; updated_at: string;
  }[];
  return rows.map(r => ({
    animeId: r.anime_id,
    animeTitle: r.anime_title,
    coverImage: r.cover_image,
    episode: r.episode,
    watchedSeconds: r.watched_seconds,
    durationSeconds: r.duration_seconds,
    updatedAt: r.updated_at,
  }));
}

export function getUserStats(userId: number): UserStats {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(watched_seconds), 0) as total_seconds,
      COUNT(DISTINCT anime_id) as anime_count,
      SUM(CASE WHEN duration_seconds > 0 AND CAST(watched_seconds AS FLOAT) / duration_seconds >= 0.85 THEN 1 ELSE 0 END) as episode_count
    FROM watch_history
    WHERE user_id = ? AND duration_seconds > 0 AND watched_seconds > 0
  `).get(userId) as { total_seconds: number; anime_count: number; episode_count: number } | undefined;
  return {
    totalSeconds: row?.total_seconds ?? 0,
    animeCount: row?.anime_count ?? 0,
    episodeCount: row?.episode_count ?? 0,
  };
}

export function getWatchHistory(userId: number, limit = 50): HistoryItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      anime_id, anime_title, cover_image,
      COUNT(*) as episode_count,
      SUM(CASE WHEN duration_seconds > 0 AND CAST(watched_seconds AS FLOAT) / duration_seconds >= 0.85 THEN 1 ELSE 0 END) as completed_episodes,
      SUM(watched_seconds) as total_seconds,
      MAX(updated_at) as last_watched
    FROM watch_history
    WHERE user_id = ? AND watched_seconds > 0
    GROUP BY anime_id
    ORDER BY last_watched DESC
    LIMIT ?
  `).all(userId, limit) as {
    anime_id: number; anime_title: string; cover_image: string;
    episode_count: number; completed_episodes: number; total_seconds: number; last_watched: string;
  }[];
  return rows.map(r => ({
    animeId: r.anime_id,
    animeTitle: r.anime_title,
    coverImage: r.cover_image,
    episodeCount: r.episode_count,
    completedEpisodes: r.completed_episodes,
    totalSeconds: r.total_seconds,
    lastWatched: r.last_watched,
  }));
}

export function addWatchlist(userId: number, animeId: number, animeTitle: string, coverImage: string): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO watchlist (user_id, anime_id, anime_title, cover_image, added_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(userId, animeId, animeTitle, coverImage);
}

export function removeWatchlist(userId: number, animeId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM watchlist WHERE user_id = ? AND anime_id = ?').run(userId, animeId);
}

export function getWatchlist(userId: number): WatchlistItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT anime_id, anime_title, cover_image, added_at
    FROM watchlist WHERE user_id = ?
    ORDER BY added_at DESC
  `).all(userId) as { anime_id: number; anime_title: string; cover_image: string; added_at: string }[];
  return rows.map(r => ({
    animeId: r.anime_id,
    animeTitle: r.anime_title,
    coverImage: r.cover_image,
    addedAt: r.added_at,
  }));
}

export function isWatchlisted(userId: number, animeId: number): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM watchlist WHERE user_id = ? AND anime_id = ?').get(userId, animeId);
  return !!row;
}

export function getUserTopGenres(userId: number, limit = 5): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT j.value as genre, COUNT(*) as cnt
    FROM watch_history wh, json_each(wh.genres_json) j
    WHERE wh.user_id = ?
      AND wh.duration_seconds > 0
      AND CAST(wh.watched_seconds AS FLOAT) / wh.duration_seconds >= 0.5
    GROUP BY j.value
    ORDER BY cnt DESC
    LIMIT ?
  `).all(userId, limit) as { genre: string }[];
  return rows.map(r => r.genre);
}

export function getWatchedAnimeIds(userId: number): number[] {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT anime_id FROM watch_history WHERE user_id = ?').all(userId) as { anime_id: number }[];
  return rows.map(r => r.anime_id);
}

export function getWeeklyTopWatchers(limit = 10): TopWatcher[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT wh.user_id, u.username,
      SUM(wh.watched_seconds) as total_seconds,
      COUNT(DISTINCT wh.anime_id) as anime_count
    FROM watch_history wh
    JOIN users u ON u.id = wh.user_id
    WHERE wh.updated_at > datetime('now', '-7 days')
    GROUP BY wh.user_id
    ORDER BY total_seconds DESC
    LIMIT ?
  `).all(limit) as { user_id: number; username: string; total_seconds: number; anime_count: number }[];
  return rows.map(r => ({
    userId: r.user_id,
    username: r.username,
    totalSeconds: r.total_seconds,
    animeCount: r.anime_count,
  }));
}

export function getWeeklyTopAnime(limit = 20): TopAnime[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT anime_id, anime_title, cover_image,
      COUNT(DISTINCT user_id) as viewer_count
    FROM watch_history
    WHERE updated_at > datetime('now', '-7 days')
    GROUP BY anime_id
    ORDER BY viewer_count DESC, SUM(watched_seconds) DESC
    LIMIT ?
  `).all(limit) as { anime_id: number; anime_title: string; cover_image: string; viewer_count: number }[];
  return rows.map(r => ({
    animeId: r.anime_id,
    animeTitle: r.anime_title,
    coverImage: r.cover_image,
    viewerCount: r.viewer_count,
  }));
}

export function getOthersWatching(excludeUserId: number, limit = 20): OthersItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT anime_id, anime_title, cover_image,
      COUNT(DISTINCT user_id) as viewer_count
    FROM watch_history
    WHERE updated_at > datetime('now', '-2 days')
      AND user_id != ?
    GROUP BY anime_id
    ORDER BY viewer_count DESC, MAX(updated_at) DESC
    LIMIT ?
  `).all(excludeUserId, limit) as { anime_id: number; anime_title: string; cover_image: string; viewer_count: number }[];
  return rows.map(r => ({
    animeId: r.anime_id,
    animeTitle: r.anime_title,
    coverImage: r.cover_image,
    viewerCount: r.viewer_count,
  }));
}

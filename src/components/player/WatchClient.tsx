'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import VideoPlayer, { type TimeRange } from './VideoPlayer';

type Translation = {
  id: number;
  title?: string;
  name?: string;
  type: 'voice' | 'subtitles' | string;
};

type SkipTimes = {
  intro: TimeRange | null;
  outro: TimeRange | null;
};

type VideoSettings = {
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  autoNextEp: boolean;
  speed: number;
};

type Props = {
  animeId: number;
  malId: number | null;
  currentEp: number;
  hasNextEpisode: boolean;
  animeTitle: string;
  coverImage: string;
  genres: string[];
};

const SPINNER = (
  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
);

const SPINNER_LG = (
  <svg className="w-8 h-8 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
);

const EN_COMBOS: Array<{ server: 'hd-1' | 'sd-1'; lang: 'dub' | 'sub'; label: string }> = [
  { server: 'hd-1', lang: 'dub', label: 'S1' },
  { server: 'sd-1', lang: 'dub', label: 'S2' },
  { server: 'hd-1', lang: 'sub', label: 'S1' },
  { server: 'sd-1', lang: 'sub', label: 'S2' },
];

export default function WatchClient({ animeId, malId, currentEp, hasNextEpisode, animeTitle, coverImage, genres }: Props) {
  const router = useRouter();

  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [initialVideoSettings, setInitialVideoSettings] = useState<Partial<VideoSettings>>({});

  // RU state
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedTid, setSelectedTid] = useState<number | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [skipTimes, setSkipTimes] = useState<SkipTimes>({ intro: null, outro: null });
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EN state
  const [enProbing, setEnProbing] = useState(false);
  const [enAvailable, setEnAvailable] = useState<Set<string>>(new Set());
  const [enStreamUrl, setEnStreamUrl] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loadingEn, setLoadingEn] = useState(false);
  const [enError, setEnError] = useState<string | null>(null);
  const enCacheRef = useRef<Record<string, string>>({});

  // Progress tracking
  const lastSaveRef = useRef(0);
  const watchedFiredRef = useRef(false);

  // Load preferences on mount
  useEffect(() => {
    fetch('/api/user/preferences')
      .then(r => r.json())
      .then(prefs => {
        if (prefs.language) setLang(prefs.language);
        setInitialVideoSettings({
          autoSkipIntro: prefs.autoSkip ?? true,
          autoSkipOutro: prefs.autoSkip ?? true,
          autoNextEp: prefs.autoPlay ?? true,
        });
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true));
  }, []);

  // Reset progress refs when episode changes
  useEffect(() => {
    watchedFiredRef.current = false;
    lastSaveRef.current = 0;
  }, [currentEp]);

  // Save progress callback
  const handleProgress = useCallback((currentTime: number, duration: number) => {
    if (!duration || duration < 10) return;
    const ratio = currentTime / duration;
    const now = Date.now();
    if (ratio >= 0.85 && !watchedFiredRef.current) {
      watchedFiredRef.current = true;
      window.dispatchEvent(new CustomEvent('episode-watched', {
        detail: { animeId, episode: currentEp },
      }));
    }
    if (now - lastSaveRef.current < 28000 && ratio < 0.95) return;
    lastSaveRef.current = now;
    fetch('/api/user/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anime_id: animeId,
        anime_title: animeTitle,
        cover_image: coverImage,
        episode: currentEp,
        watched_seconds: Math.floor(currentTime),
        duration_seconds: Math.floor(duration),
        genres,
      }),
    }).catch(() => {});
  }, [animeId, animeTitle, coverImage, currentEp, genres]);

  // Save language preference when it changes
  const langRef = useRef(lang);
  useEffect(() => {
    if (!prefsLoaded) return;
    if (lang === langRef.current) return;
    langRef.current = lang;
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang }),
    }).catch(() => {});
  }, [lang, prefsLoaded]);

  // Save video settings when they change
  const handleSettingsChange = useCallback((s: VideoSettings) => {
    if (!prefsLoaded) return;
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoSkip: s.autoSkipIntro || s.autoSkipOutro,
        autoPlay: s.autoNextEp,
      }),
    }).catch(() => {});
  }, [prefsLoaded]);

  // Probe all EN combos in parallel, cache results, auto-select first available
  const probeEnStreams = useCallback(async () => {
    setEnProbing(true);
    setEnStreamUrl(null);
    setActiveKey(null);
    setEnAvailable(new Set());
    setEnError(null);
    enCacheRef.current = {};

    const results = await Promise.all(
      EN_COMBOS.map(async ({ server, lang: l }) => {
        try {
          const res = await fetch(`/api/4animo?anilist_id=${animeId}&ep=${currentEp}&server=${server}&lang=${l}`);
          const data = await res.json();
          return { key: `${server}-${l}`, streamUrl: data.streamUrl as string | null };
        } catch {
          return { key: `${server}-${l}`, streamUrl: null };
        }
      })
    );

    const available = new Set<string>();
    for (const { key, streamUrl: url } of results) {
      if (url) { available.add(key); enCacheRef.current[key] = url; }
    }

    setEnAvailable(available);

    // Prefer sub over dub for auto-selection
    const preferredOrder = ['hd-1-sub', 'sd-1-sub', 'hd-1-dub', 'sd-1-dub'];
    const winnerKey = preferredOrder.find(k => available.has(k)) ?? null;

    if (winnerKey) {
      setActiveKey(winnerKey);
      setEnStreamUrl(enCacheRef.current[winnerKey]);
    } else {
      setEnError('Nav pieejams neviens avots šai epizodei');
    }
    setEnProbing(false);
  }, [animeId, currentEp]);

  // Probe when switching to EN or when episode changes on EN tab
  useEffect(() => {
    if (lang !== 'en') return;
    probeEnStreams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, currentEp]);

  // Select an EN stream (use cache if available)
  const selectEnStream = useCallback(async (server: 'hd-1' | 'sd-1', l: 'dub' | 'sub') => {
    const key = `${server}-${l}`;
    if (activeKey === key) return;
    setActiveKey(key);
    const cached = enCacheRef.current[key];
    if (cached) { setEnStreamUrl(cached); return; }
    setLoadingEn(true);
    setEnStreamUrl(null);
    try {
      const res = await fetch(`/api/4animo?anilist_id=${animeId}&ep=${currentEp}&server=${server}&lang=${l}`);
      const data = await res.json();
      if (data.streamUrl) {
        enCacheRef.current[key] = data.streamUrl;
        setEnStreamUrl(data.streamUrl);
      }
    } catch { /* ignore */ } finally {
      setLoadingEn(false);
    }
  }, [activeKey, animeId, currentEp]);

  // RU: load translations on malId/lang change
  useEffect(() => {
    if (!malId || lang !== 'ru') return;
    setLoadingTranslations(true);
    setTranslations([]);
    setSelectedTid(null);
    setStreamUrl(null);
    setError(null);
    fetch(`/api/kodik?action=translations&mal_id=${malId}`)
      .then(r => r.json())
      .then(data => {
        const list: Translation[] = data.translations ?? [];
        setTranslations(list);
        const first = list.find(t => t.type === 'voice') ?? list[0];
        if (first) loadStream(first.id);
      })
      .catch(() => setError('Nevar ielādēt translācijas'))
      .finally(() => setLoadingTranslations(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malId, lang]);

  // AniSkip
  useEffect(() => {
    if (!malId) return;
    fetch(`/api/aniskip?mal_id=${malId}&ep=${currentEp}`)
      .then(r => r.json())
      .then(data => setSkipTimes(data))
      .catch(() => {});
  }, [malId, currentEp]);

  // RU: reload stream when episode changes
  useEffect(() => {
    if (lang !== 'ru') return;
    if (selectedTid && malId) loadStream(selectedTid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEp]);

  const loadStream = useCallback(async (tid: number) => {
    if (!malId) return;
    setSelectedTid(tid);
    setLoadingStream(true);
    setStreamUrl(null);
    setError(null);
    try {
      const res = await fetch(`/api/kodik?action=stream&mal_id=${malId}&ep=${currentEp}&tid=${tid}`);
      const data = await res.json();
      if (data.streamUrl) setStreamUrl(data.streamUrl);
      else setError('Stream URL nav atrasts šai animei');
    } catch {
      setError('Nevar ielādēt stream');
    } finally {
      setLoadingStream(false);
    }
  }, [malId, currentEp]);

  function onNextEpisode() {
    router.push(`/watch/${animeId}?ep=${currentEp + 1}`);
  }

  const voiceTrans = translations.filter(t => t.type === 'voice');
  const subTrans = translations.filter(t => t.type !== 'voice');
  function translationLabel(t: Translation) {
    return t.title ?? t.name ?? `Translācija ${t.id}`;
  }

  const dubCombos = EN_COMBOS.filter(c => c.lang === 'dub');
  const subCombos = EN_COMBOS.filter(c => c.lang === 'sub');
  const hasDub = dubCombos.some(c => enAvailable.has(`${c.server}-${c.lang}`));
  const hasSub = subCombos.some(c => enAvailable.has(`${c.server}-${c.lang}`));

  return (
    <div>
      {/* Player */}
      {lang === 'en' ? (
        <div className="relative">
          {(enProbing || (loadingEn && !enStreamUrl)) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black rounded-xl">
              {SPINNER_LG}
            </div>
          )}
          <VideoPlayer
            streamUrl={enStreamUrl}
            intro={skipTimes.intro}
            outro={skipTimes.outro}
            onNextEpisode={onNextEpisode}
            hasNextEpisode={hasNextEpisode}
            onProgress={handleProgress}
            initialSettings={initialVideoSettings}
            onSettingsChange={handleSettingsChange}
          />
        </div>
      ) : (
        <VideoPlayer
          streamUrl={streamUrl}
          intro={skipTimes.intro}
          outro={skipTimes.outro}
          onNextEpisode={onNextEpisode}
          hasNextEpisode={hasNextEpisode}
          onProgress={handleProgress}
          initialSettings={initialVideoSettings}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {/* Source selector */}
      <div className="mt-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        {/* Language tabs */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest font-semibold">Valoda</span>
          <div className="flex rounded-lg overflow-hidden border border-[var(--border)] text-sm font-semibold ml-1">
            {(['ru', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  setStreamUrl(null);
                  setSelectedTid(null);
                  setEnStreamUrl(null);
                  setActiveKey(null);
                  setEnError(null);
                }}
                className={`px-4 py-1.5 transition-colors ${lang === l ? 'bg-[var(--primary)] text-white' : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]'}`}
              >
                {l === 'ru' ? '🇷🇺 Krievu' : '🇬🇧 Angļu'}
              </button>
            ))}
          </div>
        </div>

        {/* RU */}
        {error && (
          <p className="text-sm text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg px-4 py-2 mb-3">
            {error}
          </p>
        )}

        {lang === 'ru' && (
          <>
            {!malId && <p className="text-sm text-[var(--foreground)]/40">Nav MAL ID — Kodik nav pieejams šim anime.</p>}
            {malId && loadingTranslations && (
              <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/40">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Ielādē translācijas...
              </div>
            )}
            {!loadingTranslations && translations.length > 0 && (
              <div className="space-y-3">
                {voiceTrans.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-2">Balss dubļošana ({voiceTrans.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {voiceTrans.map(t => (
                        <button key={t.id} onClick={() => loadStream(t.id)} disabled={loadingStream}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            selectedTid === t.id ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                            : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)]/70 hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}>
                          {selectedTid === t.id && loadingStream ? SPINNER : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                          {translationLabel(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {subTrans.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-2">Subtitri ({subTrans.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {subTrans.map(t => (
                        <button key={t.id} onClick={() => loadStream(t.id)} disabled={loadingStream}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            selectedTid === t.id ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                            : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)]/70 hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}>
                          {selectedTid === t.id && loadingStream ? SPINNER : <span className="text-xs opacity-50">CC</span>}
                          {translationLabel(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!loadingTranslations && malId && translations.length === 0 && !error && (
              <p className="text-sm text-[var(--foreground)]/40">Nav pieejamu krievu translāciju.</p>
            )}
          </>
        )}

        {/* EN */}
        {lang === 'en' && (
          <div className="space-y-3">
            {enError && !enProbing && (
              <p className="text-sm text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg px-4 py-2">
                {enError}
              </p>
            )}

            {enProbing ? (
              <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/40 py-1">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Checking available sources...
              </div>
            ) : (
              <>
                {hasDub && (
                  <div>
                    <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-2">DUB</p>
                    <div className="flex flex-wrap gap-2">
                      {dubCombos.map(({ server, lang: l, label }) => {
                        const key = `${server}-${l}`;
                        if (!enAvailable.has(key)) return null;
                        const active = activeKey === key;
                        return (
                          <button key={key} onClick={() => selectEnStream(server, l)} disabled={loadingEn}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              active ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)]/70 hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}>
                            {active && loadingEn ? SPINNER : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasSub && (
                  <div>
                    <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-2">SUB</p>
                    <div className="flex flex-wrap gap-2">
                      {subCombos.map(({ server, lang: l, label }) => {
                        const key = `${server}-${l}`;
                        if (!enAvailable.has(key)) return null;
                        const active = activeKey === key;
                        return (
                          <button key={key} onClick={() => selectEnStream(server, l)} disabled={loadingEn}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              active ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)]/70 hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}>
                            {active && loadingEn ? SPINNER : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* AniSkip indicator */}
        {(skipTimes.intro || skipTimes.outro) && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-3 text-xs text-[var(--foreground)]/30">
            <span>AniSkip:</span>
            {skipTimes.intro && <span className="text-yellow-400/60">● Intro {skipTimes.intro.start}s–{skipTimes.intro.end}s</span>}
            {skipTimes.outro && <span className="text-sky-400/60">● Outro {skipTimes.outro.start}s–{skipTimes.outro.end}s</span>}
          </div>
        )}
      </div>
    </div>
  );
}

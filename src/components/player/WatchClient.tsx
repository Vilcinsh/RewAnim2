'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Anivexa's full provider roster (see docs at lvrcdn2.rewcrew.lv/docs).
// Which of these actually get probed per sub/dub is decided dynamically
// from the anivaAvailability episode listing below, not statically here.
const ANIVA_PROVIDERS: { slug: string; label: string }[] = [
  { slug: 'reanime', label: 'Reanime' },
  { slug: 'senshi', label: 'Senshi' },
  { slug: 'kaa', label: 'KickAssAnime' },
  { slug: 'anidbapp', label: 'AniDBApp' },
  { slug: 'anikoto', label: 'Anikoto' },
  { slug: 'anibd', label: 'AniBD' },
  { slug: 'animedunya', label: 'AnimeDunya' },
  { slug: 'anineko', label: 'AniNeko' },
  { slug: 'animegg', label: 'AnimeGG' },
  { slug: 'mkissa', label: 'MKissa' },
  { slug: 'anizone', label: 'AniZone' },
  { slug: '2dhive', label: '2DHive' },
  { slug: 'animenosub', label: 'AnimeNoSub' },
];

type EnCombo =
  | { source: '4animo'; server: 'hd-1' | 'sd-1'; lang: 'dub' | 'sub'; label: string }
  | { source: 'miruro'; provider: 'kiwi' | 'ally' | 'bonk'; lang: 'sub' | 'dub'; label: string }
  | { source: 'aniva'; provider: string; lang: 'sub' | 'dub'; label: string };

function comboKey(c: EnCombo): string {
  if (c.source === '4animo') return `${c.server}-${c.lang}`;
  if (c.source === 'miruro') return `miruro-${c.provider}-${c.lang}`;
  return `aniva-${c.provider}-${c.lang}`;
}

function comboUrl(c: EnCombo, animeId: number, ep: number): string {
  if (c.source === '4animo') return `/api/4animo?anilist_id=${animeId}&ep=${ep}&server=${c.server}&lang=${c.lang}`;
  if (c.source === 'miruro') return `/api/miruro?anilist_id=${animeId}&ep=${ep}&lang=${c.lang}&provider=${c.provider}`;
  return `/api/aniva?anilist_id=${animeId}&ep=${ep}&lang=${c.lang}&provider=${c.provider}`;
}

// 4animo dropped from the active list (unreliable/slow) — route still
// exists if we want it back later. "kiwi" (animepahe) ships HEVC, which
// Chrome/Firefox can't decode via MSE, so "ally" (allanime) is primary.
// "bonk" added as a fallback since ally's "Uni" HLS link has been observed
// dead-on-arrival (410 from origin) for some episodes while bonk still
// works — both probed in parallel, whichever resolves first wins. Same
// pair for dub — both providers carry dub tracks too.
const MIRURO_COMBOS: EnCombo[] = [
  { source: 'miruro', provider: 'ally', lang: 'sub', label: 'A1' },
  { source: 'miruro', provider: 'bonk', lang: 'sub', label: 'A2' },
  { source: 'miruro', provider: 'ally', lang: 'dub', label: 'A1' },
  { source: 'miruro', provider: 'bonk', lang: 'dub', label: 'A2' },
];

// Full superset used only to rank fallback order on a fatal stream error —
// actual combo availability (which aniva providers even show up) is decided
// per-anime/episode from Anivexa's own episode listing, not this list.
const EN_PREFERRED_ORDER = [
  'miruro-ally-sub', 'miruro-bonk-sub',
  ...ANIVA_PROVIDERS.map(p => `aniva-${p.slug}-sub`),
  'miruro-ally-dub', 'miruro-bonk-dub',
  ...ANIVA_PROVIDERS.map(p => `aniva-${p.slug}-dub`),
];

type AnivaAvailability = Record<string, { sub: number[]; dub: number[] }>;

// Remembers whichever EN combo the viewer actually ended up watching (auto-
// picked or manually chosen) so the next episode keeps using the same
// provider instead of whatever happens to answer fastest.
const PREFERRED_COMBO_STORAGE_KEY = 'aniva:preferredEnCombo';

function loadPreferredComboKey(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(PREFERRED_COMBO_STORAGE_KEY); } catch { return null; }
}

function savePreferredComboKey(key: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PREFERRED_COMBO_STORAGE_KEY, key); } catch { /* ignore */ }
}

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
  const [enStreamType, setEnStreamType] = useState<'hls' | 'mp4'>('hls');
  const [enSubtitleUrl, setEnSubtitleUrl] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loadingEn, setLoadingEn] = useState(false);
  const [enError, setEnError] = useState<string | null>(null);
  const enCacheRef = useRef<Record<string, { streamUrl: string; subtitleUrl: string | null; streamType: 'hls' | 'mp4' }>>({});
  const enFailedRef = useRef<Set<string>>(new Set());
  const enAvailableRef = useRef<Set<string>>(new Set());
  const enProbedKeysRef = useRef<Set<string>>(new Set());
  const enWinnerPickedRef = useRef(false);
  const enExpectedPassesRef = useRef(1);
  const enCompletedPassesRef = useRef(0);
  const enFallbackRef = useRef<Awaited<ReturnType<typeof probeCombo>> | null>(null);
  const enDubResultsRef = useRef<Awaited<ReturnType<typeof probeCombo>>[]>([]);
  const preferredComboKeyRef = useRef<string | null>(loadPreferredComboKey());
  const [anivaAvailability, setAnivaAvailability] = useState<AnivaAvailability | null>(null);

  // Progress tracking
  const lastSaveRef = useRef(0);
  const watchedFiredRef = useRef(false);
  const latestProgressRef = useRef<{ currentTime: number; duration: number } | null>(null);

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

  // Which aniva providers actually have sub/dub for which episode numbers —
  // fetched once per anime (not per episode, not per tab switch) so combo
  // availability and EN-tab probing can start immediately in the
  // background instead of waiting for the user to click the EN tab.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/aniva/episodes?anilist_id=${animeId}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setAnivaAvailability(data?.error ? {} : data); })
      .catch(() => { if (!cancelled) setAnivaAvailability({}); });
    return () => { cancelled = true; };
  }, [animeId]);

  // Combos actually worth probing for the current episode: Miruro's fixed
  // pair plus whichever aniva providers' episode listing says has this
  // episode number. Providers that report zero dub episodes (e.g.
  // AnimeDunya, which still answers a "dub" stream request with its JP sub
  // track relabeled) never get a dub combo generated in the first place.
  const enCombos = useMemo<EnCombo[]>(() => {
    const combos: EnCombo[] = [...MIRURO_COMBOS];
    if (anivaAvailability) {
      for (const p of ANIVA_PROVIDERS) {
        const avail = anivaAvailability[p.slug];
        if (!avail) continue;
        if (avail.sub.includes(currentEp)) combos.push({ source: 'aniva', provider: p.slug, lang: 'sub', label: p.label });
        if (avail.dub.includes(currentEp)) combos.push({ source: 'aniva', provider: p.slug, lang: 'dub', label: p.label });
      }
    }
    return combos;
  }, [anivaAvailability, currentEp]);

  const enComboByKey = useMemo(() => new Map(enCombos.map(c => [comboKey(c), c])), [enCombos]);

  const buildProgressPayload = useCallback((currentTime: number, duration: number) => ({
    anime_id: animeId,
    anime_title: animeTitle,
    cover_image: coverImage,
    episode: currentEp,
    watched_seconds: Math.floor(currentTime),
    duration_seconds: Math.floor(duration),
    genres,
  }), [animeId, animeTitle, coverImage, currentEp, genres]);

  // Save progress callback
  const handleProgress = useCallback((currentTime: number, duration: number) => {
    if (!duration || duration < 10) return;
    latestProgressRef.current = { currentTime, duration };
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
      body: JSON.stringify(buildProgressPayload(currentTime, duration)),
    }).catch(() => {});
  }, [animeId, currentEp, buildProgressPayload]);

  // The periodic save above only fires every ~28s, so switching episodes,
  // navigating away in-app, or closing/backgrounding the tab mid-playback
  // could silently drop up to 28s of progress. Flush the latest known
  // position immediately on all of those. sendBeacon (not fetch) for the
  // tab-hide/unload cases since the browser can cancel an in-flight fetch
  // once the page starts unloading, but is guaranteed to send a beacon.
  useEffect(() => {
    function flush() {
      const p = latestProgressRef.current;
      if (!p) return;
      const payload = buildProgressPayload(p.currentTime, p.duration);
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      if (!navigator.sendBeacon('/api/user/progress', blob)) {
        fetch('/api/user/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [buildProgressPayload]);

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

  async function probeCombo(combo: EnCombo, animeId: number, currentEp: number) {
    try {
      const res = await fetch(comboUrl(combo, animeId, currentEp));
      const data = await res.json();
      return {
        key: comboKey(combo),
        streamUrl: data.streamUrl as string | null,
        subtitleUrl: data.subtitleUrl as string | null,
        streamType: (data.streamType === 'mp4' ? 'mp4' : 'hls') as 'hls' | 'mp4',
      };
    } catch {
      return { key: comboKey(combo), streamUrl: null, subtitleUrl: null, streamType: 'hls' as const };
    }
  }

  // Race every combo in parallel — whichever resolves first with a working
  // stream wins and starts playing immediately. The rest keep resolving in
  // the background just to populate fallback buttons. Dub never wins that
  // race though — sub is the expected default for the EN tab, so a dub
  // result only becomes the initial pick if no sub combo comes back at all.
  //
  // The one exception: if we remember a provider the viewer was actually
  // watching before (see PREFERRED_COMBO_STORAGE_KEY), nothing else is
  // allowed to auto-win while that preference is still unresolved — instead
  // candidates queue up as a fallback, and only get committed once we're
  // sure the preferred provider isn't coming through this episode. Otherwise
  // switching episodes would randomly bounce between providers depending on
  // whichever happens to answer fastest.
  //
  // Probing happens in two passes — Miruro immediately, aniva's roster once
  // its episode listing arrives (`reset` tells this call whether it's
  // starting a fresh episode or merging into an already-running probe). A
  // preference can live in either pass, so "is the preferred provider ever
  // coming" can't be answered until BOTH passes have finished — tracked via
  // enExpectedPassesRef/enCompletedPassesRef so the fallback in one pass
  // never fires before the other pass got its shot at the real preference.
  const probeEnStreams = useCallback(async (combos: EnCombo[], reset: boolean) => {
    if (reset) {
      setEnProbing(true);
      setEnStreamUrl(null);
      setActiveKey(null);
      setEnAvailable(new Set());
      setEnError(null);
      enCacheRef.current = {};
      enFailedRef.current = new Set();
      enAvailableRef.current = new Set();
      enProbedKeysRef.current = new Set();
      enWinnerPickedRef.current = false;
      enExpectedPassesRef.current = 2;
      enCompletedPassesRef.current = 0;
      enFallbackRef.current = null;
      enDubResultsRef.current = [];
    }

    function commitWinner(result: Awaited<ReturnType<typeof probeCombo>>) {
      enWinnerPickedRef.current = true;
      setActiveKey(result.key);
      setEnStreamUrl(result.streamUrl);
      setEnStreamType(result.streamType);
      setEnSubtitleUrl(result.subtitleUrl);
      setEnProbing(false);
      preferredComboKeyRef.current = result.key;
      savePreferredComboKey(result.key);
    }

    function recordAvailable(result: Awaited<ReturnType<typeof probeCombo>>) {
      enAvailableRef.current.add(result.key);
      enCacheRef.current[result.key] = { streamUrl: result.streamUrl as string, subtitleUrl: result.subtitleUrl, streamType: result.streamType };
      setEnAvailable(new Set(enAvailableRef.current));
    }

    // Called once this pass has fully settled. Only actually decides
    // anything once every expected pass has reported in.
    function finishPass() {
      enCompletedPassesRef.current += 1;
      if (enWinnerPickedRef.current) return;
      if (enCompletedPassesRef.current < enExpectedPassesRef.current) return;
      if (enFallbackRef.current) { commitWinner(enFallbackRef.current); return; }
      if (enDubResultsRef.current[0]) { commitWinner(enDubResultsRef.current[0]); return; }
      setEnError('Nav pieejams neviens avots šai epizodei');
      setEnProbing(false);
    }

    const toProbe = combos.filter(c => !enProbedKeysRef.current.has(comboKey(c)));
    if (!toProbe.length) { finishPass(); return; }
    toProbe.forEach(c => enProbedKeysRef.current.add(comboKey(c)));

    const preferredKey = preferredComboKeyRef.current;
    const preferredCombo = preferredKey ? toProbe.find(c => comboKey(c) === preferredKey) : undefined;
    const others = preferredCombo ? toProbe.filter(c => c !== preferredCombo) : toProbe;

    const preferredPromise = preferredCombo
      ? probeCombo(preferredCombo, animeId, currentEp).then(result => {
          if (!result.streamUrl) return result;
          recordAvailable(result);
          if (!enWinnerPickedRef.current) commitWinner(result);
          return result;
        })
      : null;

    await Promise.all(
      others.map(async combo => {
        const result = await probeCombo(combo, animeId, currentEp);
        if (!result.streamUrl) return;
        recordAvailable(result);

        if (combo.lang === 'dub') {
          enDubResultsRef.current.push(result);
          return;
        }

        // No remembered preference anywhere in play — plain fastest-wins.
        if (!preferredKey && !enWinnerPickedRef.current) {
          commitWinner(result);
          return;
        }

        if (!enFallbackRef.current) enFallbackRef.current = result;
      })
    );

    if (preferredPromise) await preferredPromise;

    finishPass();
  }, [animeId, currentEp]);

  // Miruro's fixed pair is fast and needs no upstream lookup, so probe it
  // immediately on every episode/anime change — no reason to make it wait
  // on aniva's episode listing (which can take a few seconds on a cold
  // cache) before showing anything.
  useEffect(() => {
    probeEnStreams(MIRURO_COMBOS, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, currentEp]);

  // Once aniva's episode listing is in (immediately from cache on repeat
  // visits, ~a few seconds on a cold one), merge its combos into whatever
  // Miruro already resolved instead of restarting the whole probe. Always
  // called (even with zero aniva combos this episode) so the pass-counter
  // in probeEnStreams reliably reaches its expected count and can finalize.
  useEffect(() => {
    if (!anivaAvailability) return;
    const anivaCombos = enCombos.filter(c => c.source === 'aniva');
    probeEnStreams(anivaCombos, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anivaAvailability, currentEp]);

  // Select an EN stream (use cache if available). A manual pick is the
  // clearest signal of intent there is, so it becomes the remembered
  // provider immediately — next episode starts from this one.
  const selectEnStream = useCallback(async (combo: EnCombo) => {
    const key = comboKey(combo);
    if (activeKey === key) return;
    setActiveKey(key);
    preferredComboKeyRef.current = key;
    savePreferredComboKey(key);
    const cached = enCacheRef.current[key];
    if (cached) { setEnStreamUrl(cached.streamUrl); setEnStreamType(cached.streamType); setEnSubtitleUrl(cached.subtitleUrl); return; }
    setLoadingEn(true);
    setEnStreamUrl(null);
    setEnSubtitleUrl(null);
    try {
      const res = await fetch(comboUrl(combo, animeId, currentEp));
      const data = await res.json();
      if (data.streamUrl) {
        const streamType: 'hls' | 'mp4' = data.streamType === 'mp4' ? 'mp4' : 'hls';
        enCacheRef.current[key] = { streamUrl: data.streamUrl, subtitleUrl: data.subtitleUrl ?? null, streamType };
        setEnStreamUrl(data.streamUrl);
        setEnStreamType(streamType);
        setEnSubtitleUrl(data.subtitleUrl ?? null);
      }
    } catch { /* ignore */ } finally {
      setLoadingEn(false);
    }
  }, [activeKey, animeId, currentEp]);

  // Stream failed to load after retries (dead server/CDN) — try the next
  // available combo automatically instead of leaving a dead player up.
  // Scoped to the current combo's lang so a failed dub never silently
  // falls back to a sub stream (or vice versa). Deliberately doesn't touch
  // the remembered preference — this is a one-off resilience fallback, not
  // a provider switch the viewer chose, so the next episode still gives
  // the preferred provider another chance instead of drifting away from it
  // over a single bad request.
  const handleEnFatalError = useCallback(() => {
    if (!activeKey) return;
    const activeLang = enComboByKey.get(activeKey)?.lang;
    enFailedRef.current.add(activeKey);

    const nextKey = EN_PREFERRED_ORDER.find(k =>
      enComboByKey.get(k)?.lang === activeLang && enAvailable.has(k) && !enFailedRef.current.has(k)
    );
    const nextCombo = nextKey ? enComboByKey.get(nextKey) : undefined;

    if (!nextCombo || !nextKey) {
      setActiveKey(null);
      setEnStreamUrl(null);
      setEnSubtitleUrl(null);
      setEnError('Visi pieejamie avoti neizdevās ielādēt. Mēģini vēlāk.');
      return;
    }

    setActiveKey(nextKey);

    const cached = enCacheRef.current[nextKey];
    if (cached) {
      setEnStreamUrl(cached.streamUrl);
      setEnStreamType(cached.streamType);
      setEnSubtitleUrl(cached.subtitleUrl);
      return;
    }

    setLoadingEn(true);
    setEnStreamUrl(null);
    setEnSubtitleUrl(null);
    fetch(comboUrl(nextCombo, animeId, currentEp))
      .then(r => r.json())
      .then(data => {
        if (data.streamUrl) {
          const streamType: 'hls' | 'mp4' = data.streamType === 'mp4' ? 'mp4' : 'hls';
          enCacheRef.current[nextKey] = { streamUrl: data.streamUrl, subtitleUrl: data.subtitleUrl ?? null, streamType };
          setEnStreamUrl(data.streamUrl);
          setEnStreamType(streamType);
          setEnSubtitleUrl(data.subtitleUrl ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEn(false));
  }, [activeKey, animeId, currentEp, enAvailable, enComboByKey]);

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

  const dubCombos = enCombos.filter(c => c.lang === 'dub');
  const subCombos = enCombos.filter(c => c.lang === 'sub');
  const hasDub = dubCombos.some(c => enAvailable.has(comboKey(c)));
  const hasSub = subCombos.some(c => enAvailable.has(comboKey(c)));

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
            streamType={enStreamType}
            subtitles={enSubtitleUrl ? [{ src: enSubtitleUrl, label: 'English', lang: 'en' }] : []}
            intro={skipTimes.intro}
            outro={skipTimes.outro}
            onNextEpisode={onNextEpisode}
            hasNextEpisode={hasNextEpisode}
            onProgress={handleProgress}
            initialSettings={initialVideoSettings}
            onSettingsChange={handleSettingsChange}
            onFatalError={handleEnFatalError}
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
                      {dubCombos.map(combo => {
                        const key = comboKey(combo);
                        if (!enAvailable.has(key)) return null;
                        const active = activeKey === key;
                        return (
                          <button key={key} onClick={() => selectEnStream(combo)} disabled={loadingEn}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              active ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)]/70 hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}>
                            {active && loadingEn ? SPINNER : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                            {combo.label}
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
                      {subCombos.map(combo => {
                        const key = comboKey(combo);
                        if (!enAvailable.has(key)) return null;
                        const active = activeKey === key;
                        return (
                          <button key={key} onClick={() => selectEnStream(combo)} disabled={loadingEn}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              active ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                              : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)]/70 hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}>
                            {active && loadingEn ? SPINNER : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                            {combo.label}
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

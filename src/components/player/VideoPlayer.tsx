'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';

export type TimeRange = { start: number; end: number };

type Settings = {
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  autoNextEp: boolean;
  speed: number;
};

type SubtitleSource = {
  src: string;
  label: string;
  lang: string;
};

type Props = {
  streamUrl: string | null;
  intro?: TimeRange | null;
  outro?: TimeRange | null;
  subtitles?: SubtitleSource[];
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  onProgress?: (currentTime: number, duration: number) => void;
  initialSettings?: Partial<Settings>;
  onSettingsChange?: (s: Settings) => void;
};

type SubtitleOption = {
  id: number;
  label: string;
  lang?: string;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function cleanCueText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\{\\.*?\}/g, '')
    .trim();
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[var(--primary)]' : 'bg-white/20'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function VideoPlayer({
  streamUrl,
  intro,
  outro,
  subtitles = [],
  onNextEpisode,
  hasNextEpisode,
  onProgress,
  initialSettings,
  onSettingsChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextEpTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cueCleanupRef = useRef<(() => void) | null>(null);

  const settingsRef = useRef<Settings>({
    autoSkipIntro: true,
    autoSkipOutro: true,
    autoNextEp: true,
    speed: 1,
    ...initialSettings,
  });

  const onProgressRef = useRef(onProgress);
  const onSettingsChangeRef = useRef(onSettingsChange);
  const introRef = useRef(intro);
  const outroRef = useRef(outro);
  const selectedSubtitleRef = useRef<number>(subtitles.length > 0 ? 0 : -1);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const durationRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    autoSkipIntro: true,
    autoSkipOutro: true,
    autoNextEp: true,
    speed: 1,
    ...initialSettings,
  });
  const [nextEpCount, setNextEpCount] = useState<number | null>(null);
  const [fs, setFs] = useState(false);
  const [hlsError, setHlsError] = useState(false);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);
  const [subtitleOptions, setSubtitleOptions] = useState<SubtitleOption[]>(
    subtitles.map((sub, index) => ({ id: index, label: sub.label, lang: sub.lang }))
  );
  const [selectedSubtitle, setSelectedSubtitle] = useState<number>(subtitles.length > 0 ? 0 : -1);

  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onSettingsChangeRef.current = onSettingsChange; }, [onSettingsChange]);
  useEffect(() => { introRef.current = intro; }, [intro]);
  useEffect(() => { outroRef.current = outro; }, [outro]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    settingsRef.current = settings;
    onSettingsChangeRef.current?.(settings);
  }, [settings]);

  useEffect(() => {
    selectedSubtitleRef.current = selectedSubtitle;
  }, [selectedSubtitle]);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const clearNextEpTimer = useCallback(() => {
    if (nextEpTimer.current) {
      clearInterval(nextEpTimer.current);
      nextEpTimer.current = null;
    }
  }, []);

  const getSubtitleTracks = useCallback(() => {
    const v = videoRef.current;
    if (!v) return [];
    return Array.from(v.textTracks).filter(
      track => track.kind === 'subtitles' || track.kind === 'captions'
    );
  }, []);

  const refreshActiveCueText = useCallback(() => {
    const selected = selectedSubtitleRef.current;

    if (selected < 0) {
      setActiveCueText(null);
      return;
    }

    const tracks = getSubtitleTracks();
    const activeTrack = tracks[selected];

    if (!activeTrack || !activeTrack.activeCues?.length) {
      setActiveCueText(null);
      return;
    }

    const text = Array.from(activeTrack.activeCues)
      .map(cue => cleanCueText((cue as VTTCue).text || ''))
      .filter(Boolean)
      .join('\n');

    setActiveCueText(text || null);
  }, [getSubtitleTracks]);

  const bindSubtitleCueChange = useCallback(() => {
    cueCleanupRef.current?.();
    cueCleanupRef.current = null;

    const selected = selectedSubtitleRef.current;
    const tracks = getSubtitleTracks();

    tracks.forEach((track, index) => {
      track.mode = selected >= 0 && index === selected ? 'hidden' : 'disabled';
    });

    if (selected < 0 || !tracks[selected]) {
      setActiveCueText(null);
      return;
    }

    const activeTrack = tracks[selected];
    const onCueChange = () => refreshActiveCueText();

    activeTrack.addEventListener('cuechange', onCueChange);
    cueCleanupRef.current = () => {
      activeTrack.removeEventListener('cuechange', onCueChange);
    };

    refreshActiveCueText();
  }, [getSubtitleTracks, refreshActiveCueText]);

  const refreshSubtitleOptionsFromVideo = useCallback(() => {
    const tracks = getSubtitleTracks();

    if (!tracks.length) {
      if (subtitles.length > 0) {
        setSubtitleOptions(subtitles.map((sub, index) => ({ id: index, label: sub.label, lang: sub.lang })));
      }
      return;
    }

    setSubtitleOptions(
      tracks.map((track, index) => ({
        id: index,
        label: track.label || track.language || `Subtitles ${index + 1}`,
        lang: track.language || undefined,
      }))
    );
  }, [getSubtitleTracks, subtitles]);

  const activateSubtitleTrack = useCallback((trackIndex = selectedSubtitleRef.current) => {
    const hls = hlsRef.current;
    const tracks = getSubtitleTracks();

    selectedSubtitleRef.current = trackIndex;

    if (hls) {
      hls.subtitleTrack = trackIndex;
    }

    tracks.forEach((track, index) => {
      track.mode = trackIndex >= 0 && index === trackIndex ? 'hidden' : 'disabled';
    });

    if (trackIndex < 0) {
      setActiveCueText(null);
    }

    bindSubtitleCueChange();
  }, [bindSubtitleCueChange, getSubtitleTracks]);

  const showCtrl = useCallback(() => {
    setShowControls(true);
    clearHideTimer();
  }, [clearHideTimer]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, [clearHideTimer]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !streamUrl) return;

    if (v.paused) {
      v.play().catch(err => console.warn('Video play failed:', err));
    } else {
      v.pause();
    }
  }, [streamUrl]);

  const seek = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  }, []);

  const setVol = useCallback((val: number) => {
    setVolume(val);
    setMuted(val === 0);

    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);

    if (videoRef.current) {
      videoRef.current.muted = next;
    }
  }, [muted]);

  const toggleFs = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.warn('Fullscreen failed:', err));
    } else {
      document.exitFullscreen().catch(err => console.warn('Exit fullscreen failed:', err));
    }
  }, []);

  const cancelNextEp = useCallback(() => {
    clearNextEpTimer();
    setNextEpCount(null);
  }, [clearNextEpTimer]);

  const startNextEpCountdown = useCallback(() => {
    clearNextEpTimer();
    setNextEpCount(5);

    nextEpTimer.current = setInterval(() => {
      setNextEpCount(prev => {
        if (prev === null || prev <= 1) {
          clearNextEpTimer();

          if (settingsRef.current.autoNextEp) {
            onNextEpisode?.();
          }

          return null;
        }

        return prev - 1;
      });
    }, 1000);
  }, [clearNextEpTimer, onNextEpisode]);

  useEffect(() => {
    if (!subtitles.length) return;

    setSubtitleOptions(subtitles.map((sub, index) => ({ id: index, label: sub.label, lang: sub.lang })));

    if (selectedSubtitleRef.current < 0) {
      selectedSubtitleRef.current = 0;
      setSelectedSubtitle(0);
    }
  }, [subtitles]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    cueCleanupRef.current?.();
    cueCleanupRef.current = null;

    v.pause();
    v.removeAttribute('src');
    v.load();

    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setHlsError(false);
    setActiveCueText(null);
    setSubtitleOptions(subtitles.map((sub, index) => ({ id: index, label: sub.label, lang: sub.lang })));

    if (!streamUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxBufferHole: 2,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 3,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 4,
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        v.playbackRate = settingsRef.current.speed;
        v.volume = volume;
        v.muted = muted;

        setTimeout(() => {
          refreshSubtitleOptionsFromVideo();
          activateSubtitleTrack(selectedSubtitleRef.current);
        }, 300);

        v.play().catch(err => console.warn('Autoplay blocked or play failed:', err));
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, data) => {
        const tracks = data.subtitleTracks || [];

        if (!tracks.length) {
          refreshSubtitleOptionsFromVideo();
          return;
        }

        setSubtitleOptions(
          tracks.map((track, index) => ({
            id: index,
            label: track.name || track.lang || `Subtitles ${index + 1}`,
            lang: track.lang,
          }))
        );

        const nextTrack = selectedSubtitleRef.current >= 0 ? selectedSubtitleRef.current : 0;

        selectedSubtitleRef.current = nextTrack;
        setSelectedSubtitle(nextTrack);
        hls.subtitleTrack = nextTrack;

        setTimeout(() => {
          activateSubtitleTrack(nextTrack);
        }, 300);
      });

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_e, data) => {
        selectedSubtitleRef.current = data.id;
        setSelectedSubtitle(data.id);

        setTimeout(() => {
          activateSubtitleTrack(data.id);
        }, 200);
      });

      hls.on(Hls.Events.SUBTITLE_FRAG_PROCESSED, () => {
        setTimeout(() => {
          bindSubtitleCueChange();
          refreshActiveCueText();
        }, 100);
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          setHlsError(true);
          hls.destroy();
        }
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(v);
      hlsRef.current = hls;
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = streamUrl;
      v.playbackRate = settingsRef.current.speed;
      v.volume = volume;
      v.muted = muted;

      v.play().catch(err => console.warn('Autoplay blocked or play failed:', err));

      setTimeout(() => {
        refreshSubtitleOptionsFromVideo();
        activateSubtitleTrack(selectedSubtitleRef.current);
      }, 500);
    } else {
      setHlsError(true);
    }

    return () => {
      cueCleanupRef.current?.();
      cueCleanupRef.current = null;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  // streamUrl reload must not depend on volume/muted/settings; those are applied separately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  useEffect(() => {
    activateSubtitleTrack(selectedSubtitle);
  }, [selectedSubtitle, activateSubtitleTrack]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onAddTrack = () => {
      setTimeout(() => {
        refreshSubtitleOptionsFromVideo();
        activateSubtitleTrack(selectedSubtitleRef.current);
      }, 100);
    };

    v.textTracks.addEventListener('addtrack', onAddTrack);

    return () => {
      v.textTracks.removeEventListener('addtrack', onAddTrack);
    };
  }, [activateSubtitleTrack, refreshSubtitleOptionsFromVideo]);

  useEffect(() => {
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || !v.duration) return;
      onProgressRef.current?.(v.currentTime, v.duration);
    }, 15000);

    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function getPct(clientX: number): number {
      const bar = progressBarRef.current;
      if (!bar) return 0;

      const rect = bar.getBoundingClientRect();
      return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      setDragPct(getPct(e.clientX));
    }

    function onMouseUp(e: MouseEvent) {
      if (!isDragging.current) return;

      isDragging.current = false;
      const pct = getPct(e.clientX);
      setDragPct(null);

      const v = videoRef.current;
      if (v && durationRef.current > 0) {
        v.currentTime = (pct / 100) * durationRef.current;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!isDragging.current || !e.touches[0]) return;

      e.preventDefault();
      setDragPct(getPct(e.touches[0].clientX));
    }

    function onTouchEnd(e: TouchEvent) {
      if (!isDragging.current || !e.changedTouches[0]) return;

      isDragging.current = false;
      const pct = getPct(e.changedTouches[0].clientX);
      setDragPct(null);

      const v = videoRef.current;
      if (v && durationRef.current > 0) {
        v.currentTime = (pct / 100) * durationRef.current;
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;

      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(10);
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(-10);
      }

      if (e.key === 'f' || e.key === 'F') {
        toggleFs();
      }

      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seek, toggleFs, toggleMute, togglePlay]);

  useEffect(() => {
    const onFsc = () => setFs(!!document.fullscreenElement);

    document.addEventListener('fullscreenchange', onFsc);
    return () => document.removeEventListener('fullscreenchange', onFsc);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = settings.speed;
    }
  }, [settings.speed]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    return () => {
      clearHideTimer();
      clearNextEpTimer();

      cueCleanupRef.current?.();
      cueCleanupRef.current = null;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [clearHideTimer, clearNextEpTimer]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buffPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const displayPct = dragPct ?? progress;
  const tooltipPct = dragPct ?? hoverPct;
  const inIntro = !!intro && currentTime >= intro.start && currentTime < intro.end;
  const inOutro = !!outro && currentTime >= outro.start && currentTime < outro.end;
  const ctrlVisible = showControls || !playing || isDragging.current;

  function onBarMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();

    const bar = progressBarRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

    isDragging.current = true;
    setDragPct(pct);
  }

  function onBarTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const bar = progressBarRef.current;
    if (!bar || !e.touches[0]) return;

    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100));

    isDragging.current = true;
    setDragPct(pct);
  }

  function onBarMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isDragging.current) return;

    const bar = progressBarRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    setHoverPct(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
  }

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;

    const t = v.currentTime;

    if (!isDragging.current) {
      setCurrentTime(t);
    }

    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }

    const s = settingsRef.current;
    const i = introRef.current;
    const o = outroRef.current;

    if (s.autoSkipIntro && i && t >= i.start && t < i.end) {
      v.currentTime = i.end;
    }

    if (s.autoSkipOutro && o && t >= o.start && t < o.end) {
      v.currentTime = o.end;
    }

    // Fallback for browsers/HLS cases where cuechange is unreliable.
    refreshActiveCueText();
  }

  function handlePlayerAreaClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;

    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('option') ||
      target.closest('[data-control-area]') ||
      target.closest('[data-no-video-toggle]')
    ) {
      return;
    }

    togglePlay();
  }

  return (
    <div
      ref={containerRef}
      onClick={handlePlayerAreaClick}
      className={`relative w-full aspect-video bg-black overflow-hidden select-none ${fs ? '' : 'rounded-xl'} border border-[var(--border)]`}
      onMouseMove={() => {
        showCtrl();
        if (playing) scheduleHide();
      }}
      onMouseLeave={() => {
        if (playing) setShowControls(false);
        setHoverPct(null);
      }}
    >
      <video
        ref={videoRef}
        className="w-full h-full cursor-pointer"
        crossOrigin="anonymous"
        playsInline
        onPlay={() => {
          setPlaying(true);
          scheduleHide();
        }}
        onPause={() => {
          setPlaying(false);
          showCtrl();

          const v = videoRef.current;
          if (v && v.duration) {
            onProgressRef.current?.(v.currentTime, v.duration);
          }
        }}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => {
          const v = videoRef.current!;
          setDuration(v.duration);
          v.volume = volume;
          v.muted = muted;
          v.playbackRate = settingsRef.current.speed;

          setTimeout(() => {
            refreshSubtitleOptionsFromVideo();
            activateSubtitleTrack(selectedSubtitleRef.current);
          }, 300);
        }}
        onLoadedData={() => {
          setTimeout(() => {
            refreshSubtitleOptionsFromVideo();
            activateSubtitleTrack(selectedSubtitleRef.current);
          }, 300);
        }}
        onEnded={() => {
          setPlaying(false);
          showCtrl();

          const v = videoRef.current;
          if (v && v.duration) {
            onProgressRef.current?.(v.duration, v.duration);
          }

          if (hasNextEpisode) {
            startNextEpCountdown();
          }
        }}
      >
        {subtitles.map((sub, index) => (
          <track
            key={`${sub.src}-${index}`}
            src={sub.src}
            kind="subtitles"
            srcLang={sub.lang}
            label={sub.label}
            default={index === 0}
          />
        ))}
      </video>

      {/* Subtitle overlay */}
      {activeCueText && selectedSubtitle >= 0 && (
        <div className={`absolute left-0 right-0 flex justify-center pointer-events-none px-10 z-10 transition-all duration-150 ${ctrlVisible ? 'bottom-20' : 'bottom-4'}`}>
          <p
            className="text-white text-center text-[15px] sm:text-[18px] font-medium leading-snug max-w-[90%]"
            style={{
              textShadow: '0 1px 4px #000, 0 0 12px rgba(0,0,0,0.9)',
              whiteSpace: 'pre-line',
            }}
          >
            {activeCueText}
          </p>
        </div>
      )}

      {/* Placeholder kad nav stream */}
      {!streamUrl && !hlsError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <svg className="w-16 h-16 text-white/10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <p className="text-white/20 text-sm">Izvēlies translāciju zemāk</p>
        </div>
      )}

      {/* HLS kļūda */}
      {hlsError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <svg className="w-10 h-10 text-[var(--primary)]/50" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <p className="text-white/40 text-sm">Nevar ielādēt video</p>
        </div>
      )}

      {/* Skip intro */}
      {inIntro && !settings.autoSkipIntro && (
        <button
          onClick={() => {
            if (videoRef.current && introRef.current) {
              videoRef.current.currentTime = introRef.current.end;
            }
          }}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/75 border border-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[var(--primary)] hover:border-[var(--primary)] transition-all"
        >
          Izlaist intro
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
          </svg>
        </button>
      )}

      {/* Skip outro */}
      {inOutro && !settings.autoSkipOutro && (
        <button
          onClick={() => {
            if (videoRef.current && outroRef.current) {
              videoRef.current.currentTime = outroRef.current.end;
            }
          }}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/75 border border-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[var(--primary)] hover:border-[var(--primary)] transition-all"
        >
          Izlaist outro
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
          </svg>
        </button>
      )}

      {/* Nākamā epizode */}
      {nextEpCount !== null && hasNextEpisode && (
        <div className="absolute bottom-24 right-4 z-20 bg-black/85 border border-white/15 backdrop-blur-sm rounded-xl p-4 text-white min-w-48">
          <p className="text-sm mb-3 font-medium">
            Nākamā epizode pēc <span className="text-[var(--primary)] font-bold">{nextEpCount}s</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                cancelNextEp();
                onNextEpisode?.();
              }}
              className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Skatīties →
            </button>
            <button
              onClick={cancelNextEp}
              className="bg-white/10 hover:bg-white/20 text-white/70 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Atcelt
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${ctrlVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div
          data-control-area
          className="bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-4 pt-16"
        >

          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className={`relative flex items-center h-4 mb-2.5 cursor-pointer group/bar ${dragPct !== null ? '[&_[data-bar]]:h-1.5 [&_[data-thumb]]:opacity-100 [&_[data-thumb]]:scale-100' : ''}`}
            onMouseDown={onBarMouseDown}
            onMouseMove={onBarMouseMove}
            onMouseLeave={() => setHoverPct(null)}
            onTouchStart={onBarTouchStart}
          >
            {/* Tooltip */}
            {tooltipPct !== null && duration > 0 && (
              <div
                className="absolute -top-7 -translate-x-1/2 bg-black/90 text-white text-xs font-medium px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-10"
                style={{ left: `${tooltipPct}%` }}
              >
                {fmt((tooltipPct / 100) * duration)}
              </div>
            )}

            {/* Track */}
            <div
              data-bar
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 group-hover/bar:h-1.5 bg-white/20 rounded-full transition-[height] overflow-visible"
            >
              {/* Buffered */}
              <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full pointer-events-none" style={{ width: `${buffPct}%` }} />

              {/* Intro marker */}
              {intro && duration > 0 && (
                <div
                  className="absolute inset-y-0 bg-yellow-400/50 pointer-events-none rounded-full"
                  style={{
                    left: `${(intro.start / duration) * 100}%`,
                    width: `${((intro.end - intro.start) / duration) * 100}%`,
                  }}
                />
              )}

              {/* Outro marker */}
              {outro && duration > 0 && (
                <div
                  className="absolute inset-y-0 bg-sky-400/50 pointer-events-none rounded-full"
                  style={{
                    left: `${(outro.start / duration) * 100}%`,
                    width: `${((outro.end - outro.start) / duration) * 100}%`,
                  }}
                />
              )}

              {/* Progress fill */}
              <div className="absolute inset-y-0 left-0 bg-[var(--primary)] rounded-full pointer-events-none" style={{ width: `${displayPct}%` }} />
            </div>

            {/* Thumb */}
            <div
              data-thumb
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none opacity-0 scale-75 group-hover/bar:opacity-100 group-hover/bar:scale-100 transition-[opacity,transform] z-10"
              style={{ left: `${displayPct}%` }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white hover:text-[var(--primary)] transition-colors shrink-0">
              {playing ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button onClick={() => seek(-10)} className="text-white/60 hover:text-white text-xs font-bold transition-colors">-10</button>
            <button onClick={() => seek(10)} className="text-white/60 hover:text-white text-xs font-bold transition-colors">+10</button>

            <div className="flex items-center gap-1.5 group/vol">
              <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors shrink-0">
                {muted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                )}
              </button>

              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={e => setVol(Number(e.target.value))}
                  className="w-20 h-1 accent-[var(--primary)] cursor-pointer block"
                />
              </div>
            </div>

            <span className="text-white/50 text-xs tabular-nums shrink-0">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <div className="flex-1" />

            {subtitleOptions.length > 0 && (
              <select
                value={selectedSubtitle}
                onChange={e => setSelectedSubtitle(Number(e.target.value))}
                className="bg-white/10 border border-white/15 text-white text-xs rounded-md px-1.5 py-1 focus:outline-none cursor-pointer shrink-0 max-w-28"
                title="Subtitles"
              >
                <option value={-1} className="bg-[#1a1a1a]">Subs off</option>
                {subtitleOptions.map(option => (
                  <option key={`${option.id}-${option.label}`} value={option.id} className="bg-[#1a1a1a]">
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            <select
              value={settings.speed}
              onChange={e => setSettings(s => ({ ...s, speed: Number(e.target.value) }))}
              className="bg-white/10 border border-white/15 text-white text-xs rounded-md px-1.5 py-1 focus:outline-none cursor-pointer shrink-0"
            >
              {SPEEDS.map(s => (
                <option key={s} value={s} className="bg-[#1a1a1a]">{s}x</option>
              ))}
            </select>

            <div className="relative shrink-0">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowSettings(s => !s);
                }}
                className={`transition-colors ${showSettings ? 'text-white' : 'text-white/60 hover:text-white'}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.14,12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4,2.81C14.36,2.57,14.16,2.4,13.92,2.4H10.08c-.24,0-.43.17-.47.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-.22-.08-.47,0-.59.22L2.74,8.87c-.12.21-.08.47.12.61l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s.02.64.07.94L2.84,14.52c-.18.14-.23.41-.12.61l1.92,3.32c.12.22.37.29.59.22l2.39-.96c.5.38,1.03.7,1.62.94l.36,2.54c.05.24.24.41.48.41h3.84c.24,0,.44-.17.47-.41l.36-2.54c.59-.24,1.13-.56,1.62-.94l2.39.96c.22.08.47,0,.59-.22l1.92-3.32c.12-.22.07-.47-.12-.61L19.14,12.94zM12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6 3.6,1.62 3.6,3.6S13.98,15.6,12,15.6z" />
                </svg>
              </button>

              {showSettings && (
                <div
                  className="absolute bottom-9 right-0 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 w-60 shadow-2xl z-30"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="text-xs text-[var(--foreground)]/40 uppercase tracking-widest mb-2 font-semibold">Iestatījumi</p>

                  {([
                    ['autoSkipIntro', 'Auto intro izlaišana'],
                    ['autoSkipOutro', 'Auto outro izlaišana'],
                    ['autoNextEp', 'Auto nākamā epizode'],
                  ] as [keyof Omit<Settings, 'speed'>, string][]).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                      <span className="text-sm text-[var(--foreground)]/70">{label}</span>
                      <Toggle checked={settings[key]} onChange={() => setSettings(s => ({ ...s, [key]: !s[key] }))} />
                    </div>
                  ))}

                  {subtitleOptions.length > 0 && (
                    <div className="pt-2 border-b border-[var(--border)] pb-3">
                      <p className="text-xs text-[var(--foreground)]/40 mb-2">Subtitri</p>
                      <select
                        value={selectedSubtitle}
                        onChange={e => setSelectedSubtitle(Number(e.target.value))}
                        className="w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-xs rounded-md px-2 py-1.5 focus:outline-none cursor-pointer"
                      >
                        <option value={-1}>Izslēgti</option>
                        {subtitleOptions.map(option => (
                          <option key={`${option.id}-${option.label}`} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-2">
                    <p className="text-xs text-[var(--foreground)]/40 mb-2">Ātrums</p>
                    <div className="flex gap-1 flex-wrap">
                      {SPEEDS.map(s => (
                        <button
                          key={s}
                          onClick={() => setSettings(st => ({ ...st, speed: s }))}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${settings.speed === s ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--foreground)]/60 hover:text-[var(--foreground)]'}`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleFs} className="text-white/60 hover:text-white transition-colors shrink-0">
              {fs ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

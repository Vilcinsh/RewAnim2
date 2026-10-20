'use client';

import { useEffect, useRef, useState } from 'react';
import { fancyMotionAllowed } from '@/lib/lite';

const SAMPLE_MS = 1000;

/**
 * Soft glow behind the player taken from the current video frame: the frame
 * is drawn ~1×/s into a tiny canvas that is blown up and blurred behind the
 * player. Only drawing — pixels are never read back, so cross-origin streams
 * work too. Falls back to the page accent (e.g. for the MegaPlay iframe).
 * Off in lite mode / reduced motion.
 */
export default function AmbientGlow({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setEnabled(fancyMotionAllowed()), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const iv = setInterval(() => {
      if (document.hidden) return;
      const v = wrap.current?.querySelector('video');
      const ok = !!v && v.readyState >= 2 && !v.paused;
      setHasVideo(prev => (prev === ok ? prev : ok));
      if (ok) {
        try { ctx.drawImage(v, 0, 0, 32, 18); } catch { /* not drawable yet */ }
      }
    }, SAMPLE_MS);
    return () => clearInterval(iv);
  }, [enabled]);

  return (
    <div ref={wrap} className="relative isolate">
      {enabled && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 aspect-video">
          <canvas ref={canvas} width={32} height={18}
            className={`absolute inset-0 h-full w-full scale-110 blur-[80px] transition-opacity duration-1000 ${hasVideo ? 'opacity-60' : 'opacity-0'}`} />
          <div className={`absolute inset-0 scale-105 blur-[90px] transition-opacity duration-1000 ${hasVideo ? 'opacity-0' : 'opacity-20'}`}
            style={{ background: 'radial-gradient(closest-side, var(--accent), transparent)' }} />
        </div>
      )}
      {children}
    </div>
  );
}

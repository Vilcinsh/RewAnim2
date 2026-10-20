'use client';

import { useEffect } from 'react';
import { fancyMotionAllowed, isLite } from '@/lib/lite';

const MAX_TILT = 7; // degrees

/**
 * Page-wide visual effects, mounted once in the protected layout:
 * - syncs lite mode onto <html data-lite> (CSS turns effects off from there)
 * - card tilt + sheen: one delegated pointer listener for every [data-tilt]
 *   element instead of a client component per card. Skipped inside
 *   [data-no-tilt] (hover-preview rows, where the preview sits on the card).
 */
export default function Effects() {
  useEffect(() => {
    document.documentElement.toggleAttribute('data-lite', isLite());
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let active: HTMLElement | null = null;
    let frame = 0;

    function reset(el: HTMLElement) {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
      el.removeAttribute('data-tilting');
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return;
      const target = (e.target as Element | null)?.closest<HTMLElement>('[data-tilt]') ?? null;
      if (active && active !== target) { reset(active); active = null; }
      if (!target || target.closest('[data-no-tilt]') || !fancyMotionAllowed()) return;
      active = target;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = target.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        target.style.setProperty('--ry', `${(x - 0.5) * 2 * MAX_TILT}deg`);
        target.style.setProperty('--rx', `${(0.5 - y) * 2 * MAX_TILT}deg`);
        target.style.setProperty('--mx', `${x * 100}%`);
        target.style.setProperty('--my', `${y * 100}%`);
        target.setAttribute('data-tilting', '');
      });
    }

    function onLeave() { if (active) { reset(active); active = null; } }

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  return null;
}

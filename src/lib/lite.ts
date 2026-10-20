'use client';

import { useSyncExternalStore } from 'react';

// "Lite mode": turns off trailers, card tilt, ambient player glow, grain and
// view-transition morphs. Per device (localStorage), defaults on for TVs.
const KEY = 'rew:lite';
const EVENT = 'rew:lite-change';

const TV_UA = /SMART-TV|SmartTV|Tizen|Web0S|WebOS|AndroidTV|BRAVIA|CrKey|AFT/i;

export function isLite(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = localStorage.getItem(KEY);
    if (v != null) return v === '1';
  } catch { /* storage blocked */ }
  return TV_UA.test(navigator.userAgent);
}

export function setLite(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  document.documentElement.toggleAttribute('data-lite', on);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb); };
}

export function useLite(): boolean {
  return useSyncExternalStore(subscribe, isLite, () => false);
}

/** No reduced motion and not in lite mode. */
export function fancyMotionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  return !isLite() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

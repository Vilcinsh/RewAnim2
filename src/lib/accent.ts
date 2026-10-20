// Per-anime accent derived from AniList coverImage.color, adjusted so it
// passes contrast where it's used:
//  --accent       fill behind white text (buttons, badges)   ≥ 4.5:1 vs #fff
//  --accent-text  accent-coloured text on the page background ≥ 4.5:1 vs --bg
// Applied as CSS variables on a page wrapper, so every token-based utility
// (bg-accent, text-accent-fg, border-accent…) picks it up automatically.

import type { CSSProperties } from 'react';

type RGB = [number, number, number];
const BG: RGB = [14, 14, 17];
const WHITE: RGB = [255, 255, 255];

function parseHex(hex: string): RGB | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: RGB) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

/** Moves `c` toward `target` in small steps until it reaches `ratio` against `against`. */
function untilContrast(c: RGB, target: RGB, against: RGB, ratio: number): RGB {
  let out = c;
  for (let t = 0; t <= 1 && contrast(out, against) < ratio; t += 0.04) out = mix(c, target, t);
  return out;
}

/** CSS variables for an anime's accent, or null to keep the brand red (missing or near-grey colour). */
export function animeAccentVars(color: string | null | undefined): CSSProperties | null {
  const base = color ? parseHex(color) : null;
  if (!base || saturation(base) < 0.28) return null;
  const fill = untilContrast(base, [0, 0, 0], WHITE, 4.5);
  const text = untilContrast(base, WHITE, BG, 4.5);
  return {
    '--accent': toHex(fill),
    '--accent-text': toHex(text),
    '--accent-soft': toHex(mix(BG, base, 0.14)),
    '--accent-border': toHex(mix(BG, base, 0.38)),
  } as CSSProperties;
}

// Genre chips: each genre its own hue at the same lightness/saturation, so no
// genre reads as more important than another.
const GENRE_HUES: Record<string, number> = {
  Action: 8, Adventure: 32, Comedy: 50, Drama: 280, Ecchi: 330, Fantasy: 262, Horror: 350,
  'Mahou Shoujo': 315, Mecha: 200, Music: 300, Mystery: 230, Psychological: 245, Romance: 340,
  'Sci-Fi': 190, 'Slice of Life': 140, Sports: 100, Supernatural: 215, Thriller: 0,
};

export function genreTint(genre: string): string {
  let hue = GENRE_HUES[genre];
  if (hue == null) {
    hue = 0;
    for (const ch of genre) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  }
  return `hsl(${hue} 70% 62%)`;
}

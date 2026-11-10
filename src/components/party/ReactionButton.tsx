'use client';

import { useEffect, useRef } from 'react';

const REPEAT_MS = 140;

type Props = {
  emoji: string;
  label: string;
  onReact: (emoji: string) => void;
  className?: string;
};

// Tap = one reaction; press and hold = a stream of them (the server's
// per-viewer bucket decides how many actually go out).
export default function ReactionButton({ emoji, label, onReact, className = '' }: Props) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  return (
    <button type="button" aria-label={label} title={label}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onReact(emoji);
        stop();
        timer.current = setInterval(() => onReact(emoji), REPEAT_MS);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      // Keyboard activation (Enter/Space) arrives as a click with detail 0;
      // pointer clicks were already handled on pointerdown.
      onClick={e => { if (e.detail === 0) onReact(emoji); }}
      onContextMenu={e => e.preventDefault()}
      className={`touch-none select-none ${className}`}>
      {emoji}
    </button>
  );
}

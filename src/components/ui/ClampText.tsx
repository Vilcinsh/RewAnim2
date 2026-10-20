'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { strings } from '@/lib/strings';

type Props = { text: string; lines?: number; className?: string };

/** Paragraph clamped to `lines` with a Read more / Show less toggle (only when it actually overflows). */
export default function ClampText({ text, lines = 3, className = '' }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => { if (!open) setOverflows(el.scrollHeight > el.clientHeight + 1); };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, text]);

  return (
    <>
      <p ref={ref} className={`m-0 ${className}`}
        style={open ? undefined : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {text}
      </p>
      {(overflows || open) && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="self-start py-1 text-sm font-semibold text-accent-fg hover:text-fg">
          {open ? strings.anime.showLess : strings.anime.readMore}
        </button>
      )}
    </>
  );
}

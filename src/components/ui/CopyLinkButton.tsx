'use client';

import { useState } from 'react';
import { strings } from '@/lib/strings';
import { CheckIcon, LinkIcon } from './icons';

export default function CopyLinkButton({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  }
  return (
    <button type="button" onClick={copy} aria-label={copied ? strings.anime.copied : strings.anime.copyLink}
      title={copied ? strings.anime.copied : strings.anime.copyLink}
      className={`flex h-[50px] w-[50px] items-center justify-center rounded-btn border border-line-hover bg-surface-2 text-fg transition-colors hover:border-fg-2 ${className}`}>
      {copied ? <CheckIcon size={18} strokeWidth={2.5} className="text-success" /> : <LinkIcon size={18} />}
    </button>
  );
}

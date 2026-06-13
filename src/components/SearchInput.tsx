'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

type Props = {
  initialValue?: string;
};

export default function SearchInput({ initialValue = '' }: Props) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      router.replace('/search', { scroll: false });
      return;
    }
    debounceRef.current = setTimeout(() => {
      router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [value, router]);

  return (
    <div className="relative">
      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/30 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search anime..."
        autoFocus
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-12 pr-5 py-3.5 text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:outline-none focus:border-[var(--primary)] transition-colors text-base"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--foreground)]/30 hover:text-[var(--foreground)]/60 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      )}
    </div>
  );
}

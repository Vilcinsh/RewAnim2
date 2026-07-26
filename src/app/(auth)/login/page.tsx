'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError('Nepareizs lietotājvārds vai parole.');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[var(--primary)] tracking-tight">ani</h1>
          <p className="text-[var(--foreground)]/50 text-sm mt-1">rewcrew.lv</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 shadow-2xl"
        >
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-6">Ielogoties</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--foreground)]/70 mb-1.5">
                Lietotājvārds
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:outline-none focus:border-[var(--primary)] transition-colors"
                placeholder="lietotajvards"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--foreground)]/70 mb-1.5">
                Parole
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--foreground)] placeholder-[var(--foreground)]/30 focus:outline-none focus:border-[var(--primary)] transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-[var(--primary-light)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Lūdzu uzgaidiet...' : 'Ielogoties'}
          </button>
        </form>
      </div>
    </div>
  );
}

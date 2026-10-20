import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header/MobileNav read search params (active tab) → need a Suspense boundary. */}
      <Suspense fallback={<div style={{ height: 'var(--header-h)' }} />}>
        <Header user={session.user} />
      </Suspense>
      <main className="flex-1">
        {children}
      </main>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}

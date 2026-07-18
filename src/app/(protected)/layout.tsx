import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MobileNav from '@/components/MobileNav';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar user={session.user} />
      <main className="flex-1">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

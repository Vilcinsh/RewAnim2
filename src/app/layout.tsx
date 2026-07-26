import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from 'next-auth/react';

export const metadata: Metadata = {
  title: 'ani.rewcrew.lv',
  description: 'Privāta anime skatīšanas platforma',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lv" className="h-full">
      <body className="min-h-full flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

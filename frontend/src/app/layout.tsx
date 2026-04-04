import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Onda – Find the vibe',
  description: 'Real-time nightlife vibes in Kansas City',
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-onda-bg">
        <Nav />
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}

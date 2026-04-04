'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from './AuthModal';
import clsx from 'clsx';

const LINKS = [
  { href: '/',      label: 'Map'  },
  { href: '/feed',  label: 'Feed' },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-40 h-14 border-b border-onda-border bg-onda-bg/90 backdrop-blur-md flex items-center px-4 gap-4">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold text-onda-purple tracking-tight mr-2">
          Onda
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-1">
          {LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                pathname === l.href
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              )}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="/venue/scan"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
          >
            Scanner
          </a>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auth */}
        <div className="hidden sm:flex items-center gap-2">
          {user ? (
            <>
              <Link href="/profile" className="btn-ghost text-sm">Profile</Link>
              <button onClick={() => signOut()} className="btn-ghost text-sm">Sign out</button>
            </>
          ) : (
            <button onClick={() => setShowAuth(true)} className="btn-primary text-sm py-1.5 px-3">
              Sign in
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-zinc-400 hover:text-zinc-100"
          onClick={() => setMenuOpen(o => !o)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed top-14 inset-x-0 z-30 bg-onda-card border-b border-onda-border sm:hidden p-4 flex flex-col gap-2">
          {LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm font-medium',
                pathname === l.href ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'
              )}
            >
              {l.label}
            </Link>
          ))}
          <a href="/venue/scan" target="_blank" className="px-3 py-2 text-sm text-zinc-400">Scanner</a>
          <div className="border-t border-onda-border pt-2">
            {user ? (
              <div className="flex gap-2">
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="btn-ghost text-sm flex-1 text-center">Profile</Link>
                <button onClick={() => { signOut(); setMenuOpen(false); }} className="btn-ghost text-sm flex-1">Sign out</button>
              </div>
            ) : (
              <button onClick={() => { setShowAuth(true); setMenuOpen(false); }} className="btn-primary w-full text-sm">
                Sign in
              </button>
            )}
          </div>
        </div>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}

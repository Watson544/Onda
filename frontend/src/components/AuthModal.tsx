'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const { signIn, signUp } = useAuth();
  const [tab,     setTab]     = useState<'in' | 'up'>('in');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [name,    setName]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'in') {
        await signIn(email, pass);
        onClose();
      } else {
        await signUp(email, pass, name);
        setDone(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-6 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 text-xl leading-none"
        >
          ✕
        </button>

        {/* Logo */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-onda-purple tracking-tight">Onda</span>
          <p className="text-zinc-400 text-sm mt-1">Find the vibe</p>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-zinc-100 font-medium">Check your email</p>
            <p className="text-zinc-400 text-sm mt-1">We sent a confirmation link to {email}</p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">Got it</button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex rounded-xl bg-zinc-900 p-1 mb-5">
              {(['in', 'up'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  {t === 'in' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {tab === 'up' && (
                <input
                  className="input"
                  type="text"
                  placeholder="Display name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              )}
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                required
                minLength={6}
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
                {loading ? 'Please wait…' : tab === 'in' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

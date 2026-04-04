'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { UserProfile } from '@/lib/types';
import Link from 'next/link';

const BADGE_THRESHOLDS = [
  { label: '🌱 Newcomer',   min: 0   },
  { label: '🔥 Regular',    min: 50  },
  { label: '⚡ Local Guide', min: 200 },
  { label: '👑 Scene King',  min: 500 },
];

function getBadge(points: number) {
  return [...BADGE_THRESHOLDS].reverse().find(b => points >= b.min)!;
}

export default function ProfilePage() {
  const { user, token, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    api.users.me(token)
      .then(res => setProfile(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (authLoading || loading) {
    return <div className="p-8 text-zinc-400 animate-pulse">Loading profile…</div>;
  }

  if (!profile) return null;

  const badge    = getBadge(profile.points);
  const nextBadge = BADGE_THRESHOLDS.find(b => b.min > profile.points);
  const progress  = nextBadge
    ? ((profile.points - (getBadge(profile.points).min)) / (nextBadge.min - getBadge(profile.points).min)) * 100
    : 100;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-zinc-100">Profile</h1>

      {/* Identity card */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-onda-purple to-onda-teal flex items-center justify-center text-2xl font-bold text-zinc-950">
            {(profile.display_name ?? profile.email)[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-zinc-100 text-lg">{profile.display_name ?? 'No name set'}</p>
            <p className="text-zinc-400 text-sm">{profile.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm">{badge.label}</span>
              {profile.is_vip && (
                <span className="text-xs bg-onda-purple/20 text-onda-purple border border-onda-purple/30 rounded-full px-2 py-0.5">
                  VIP
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Points */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-100">Points</h2>
          <span className="text-2xl font-bold text-onda-purple">{profile.points.toLocaleString()}</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-onda-purple to-onda-teal transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        {nextBadge && (
          <p className="text-xs text-zinc-500 mt-2">
            {nextBadge.min - profile.points} points to {nextBadge.label}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-zinc-100">{profile.points}</p>
          <p className="text-xs text-zinc-500 mt-0.5">Total Points</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-zinc-100">{profile.is_vip ? '⭐' : '—'}</p>
          <p className="text-xs text-zinc-500 mt-0.5">VIP Status</p>
        </div>
      </div>

      {/* Actions */}
      <div className="card p-5 space-y-2">
        <Link href="/" className="btn-secondary w-full text-center block text-sm">
          Back to Map
        </Link>
        <button
          onClick={async () => { await signOut(); router.push('/'); }}
          className="w-full text-sm text-red-400 hover:text-red-300 py-2 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

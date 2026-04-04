'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Venue, VibeHistory, VibeSubmission } from '@/lib/types';
import VibeBadge from '@/components/VibeBadge';
import VibeScore from '@/components/VibeScore';
import VibeChart from '@/components/VibeChart';
import VibeForm from '@/components/VibeForm';
import FeedItem from '@/components/FeedItem';

export default function VenuePage() {
  const { id } = useParams<{ id: string }>();
  const [venue,    setVenue]    = useState<Venue | null>(null);
  const [history,  setHistory]  = useState<VibeHistory[]>([]);
  const [vibes,    setVibes]    = useState<VibeSubmission[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    try {
      const [venueRes, vibesRes] = await Promise.all([
        api.venues.get(id),
        api.vibes.forVenue(id),
      ]);
      setVenue(venueRes.data);
      setHistory(venueRes.history ?? []);
      setVibes(vibesRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load venue');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: update score/state live
  useEffect(() => {
    const channel = supabase
      .channel(`venue-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'venues', filter: `id=eq.${id}` },
        payload => setVenue(prev => prev ? { ...prev, ...(payload.new as Venue) } : prev)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) return <div className="p-8 text-zinc-400 animate-pulse">Loading…</div>;
  if (error)   return <div className="p-8 text-red-400">{error}</div>;
  if (!venue)  return <div className="p-8 text-zinc-400">Venue not found</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Back */}
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
        ← Back to map
      </Link>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-zinc-100">{venue.name}</h1>
              {venue.is_verified && (
                <span className="text-xs bg-onda-teal/10 text-onda-teal border border-onda-teal/20 rounded-full px-2 py-0.5">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-zinc-400 text-sm mt-0.5">{venue.address} · {venue.city}</p>
            {venue.description && (
              <p className="text-zinc-300 text-sm mt-2 leading-relaxed">{venue.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <VibeBadge state={venue.vibe_state} />
              {venue.venue_type && (
                <span className="text-xs text-zinc-400 capitalize bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-0.5">
                  {venue.venue_type}
                </span>
              )}
              <span className="text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-0.5 capitalize">
                {venue.tier}
              </span>
            </div>
          </div>
          <VibeScore score={venue.vibe_score} state={venue.vibe_state} size={88} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Vibe Score',  value: Math.round(venue.vibe_score).toString() },
          { label: 'Pass Price',  value: `$${(venue.amount_cents / 100).toFixed(2)}` },
          { label: 'Status',      value: venue.vibe_state.replace('_', ' ') },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
            <p className="text-lg font-bold text-zinc-100 capitalize">{value}</p>
          </div>
        ))}
      </div>

      {/* Vibe history chart */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Vibe History (24h)</h2>
        <VibeChart history={history} />
      </div>

      {/* Skip the Line (placeholder) */}
      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-100">Skip the Line</h3>
          <p className="text-zinc-400 text-sm">Reserve your spot — ${(venue.amount_cents / 100).toFixed(2)}</p>
        </div>
        <button disabled className="btn-primary opacity-40 cursor-not-allowed text-sm px-5">
          Coming Soon
        </button>
      </div>

      {/* Submit vibe */}
      <VibeForm venueId={venue.id} onSuccess={load} />

      {/* Recent vibes */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Recent Vibes</h2>
        {vibes.length === 0 ? (
          <div className="card p-6 text-center text-zinc-500 text-sm">
            No vibe checks yet — be the first!
          </div>
        ) : (
          <div className="space-y-3">
            {vibes.map(v => <FeedItem key={v.id} sub={v} />)}
          </div>
        )}
      </div>
    </div>
  );
}

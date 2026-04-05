'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { VIBE_STATE_CONFIG, type Venue } from '@/lib/types';
import VibeBadge from './VibeBadge';
import VibeScore from './VibeScore';

const OSM_EMBED =
  'https://www.openstreetmap.org/export/embed.html?bbox=-94.7,39.0,-94.4,39.2&layer=mapnik';

export default function MapView() {
  const [venues,  setVenues]  = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchVenues = useCallback(async () => {
    try {
      const res = await api.venues.list('Kansas City');
      setVenues(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load venues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVenues(); }, [fetchVenues]);

  useEffect(() => {
    const channel = supabase
      .channel('venues-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'venues' },
        payload => {
          const updated = payload.new as Venue;
          setVenues(prev =>
            prev.map(v => v.id === updated.id ? { ...v, ...updated } : v)
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* ── Map iframe ───────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <iframe
          src={OSM_EMBED}
          title="Kansas City map"
          className="w-full h-full border-0"
          style={{ display: 'block' }}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {/* Live badge */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          Live
        </div>
      </div>

      {/* ── Venue list panel ─────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-l border-onda-border bg-onda-bg overflow-y-auto">
        <div className="sticky top-0 bg-onda-bg border-b border-onda-border px-4 py-3 z-10">
          <h2 className="font-semibold text-zinc-100 text-sm">KC Venues</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {loading ? 'Loading…' : `${venues.length} venues`}
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 text-red-400 text-sm">{error}</div>
        )}

        {loading && !error && (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && venues.length > 0 && (
          <ul className="divide-y divide-onda-border">
            {venues.map(venue => (
              <li key={venue.id}>
                <Link
                  href={`/venue/${venue.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <VibeScore score={venue.vibe_score} state={venue.vibe_state} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-100 text-sm font-medium truncate">{venue.name}</p>
                    <p className="text-zinc-500 text-xs truncate mt-0.5">{venue.address}</p>
                    <div className="mt-1">
                      <VibeBadge state={venue.vibe_state} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

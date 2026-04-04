'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useId } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { VIBE_STATE_CONFIG, type Venue } from '@/lib/types';

// Dynamic import with ssr:false keeps Leaflet out of the SSR bundle entirely.
// Rendering it as a child of this already-client component means the browser
// always gets a fresh module context on each mount, avoiding the
// "Map container is already initialized" error from Turbopack HMR.
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-onda-bg">
      <div className="text-zinc-400 animate-pulse">Loading map…</div>
    </div>
  ),
});

export default function MapView() {
  const [venues,  setVenues]  = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Stable identity key: a new DOM subtree is created if this ever changes,
  // guaranteeing Leaflet never encounters a container with a stale _leaflet_id.
  const mapKey = useId();

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

  // Supabase Realtime – live venue vibe_score / vibe_state updates
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-onda-bg">
        <div className="text-zinc-400 animate-pulse">Loading map…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-onda-bg">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-56px)]">
      {/* key prop ensures a fresh DOM container whenever mapKey changes,
          preventing Leaflet from seeing a node with an existing _leaflet_id */}
      <LeafletMap key={mapKey} venues={venues} />

      {/* Legend */}
      <div className="absolute bottom-6 left-4 z-[999] card p-3 flex flex-col gap-1.5">
        {(Object.entries(VIBE_STATE_CONFIG) as [string, typeof VIBE_STATE_CONFIG[keyof typeof VIBE_STATE_CONFIG]][]).map(([state, cfg]) => (
          <div key={state} className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Live indicator */}
      <div className="absolute top-4 right-4 z-[999] flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700 rounded-full px-3 py-1 text-xs text-zinc-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        Live
      </div>
    </div>
  );
}

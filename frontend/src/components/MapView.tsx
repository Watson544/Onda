'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { VIBE_STATE_CONFIG, type Venue } from '@/lib/types';
import VibeBadge from './VibeBadge';
import VibeScore from './VibeScore';
import Link from 'next/link';

const KC: [number, number] = [39.0997, -94.5786];

function FitBounds({ venues }: { venues: Venue[] }) {
  const map = useMap();
  useEffect(() => {
    if (venues.length === 0) return;
    const lats = venues.map(v => v.lat);
    const lngs = venues.map(v => v.lng);
    map.fitBounds([
      [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
      [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01],
    ]);
  }, [map, venues]);
  return null;
}

export default function MapView() {
  const [venues,  setVenues]  = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        // Grab the container div before remove() tears it down.
        const container = mapRef.current.getContainer();
        // Destroy the Leaflet instance (clears internal state).
        mapRef.current.remove();
        mapRef.current = null;
        // Explicitly delete the ID Leaflet brands on the DOM node so that
        // React StrictMode's remount (or webpack HMR) can re-initialize on
        // the same element without hitting "Map container is already initialized".
        if (container) {
          delete (container as unknown as Record<string, unknown>)._leaflet_id;
        }
      }
    };
  }, []);

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

  // Supabase Realtime – venue score/state updates
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
      <MapContainer
        ref={mapRef}
        center={KC}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <FitBounds venues={venues} />

        {venues.map(venue => {
          const cfg   = VIBE_STATE_CONFIG[venue.vibe_state];
          const score = Math.round(venue.vibe_score);
          const radius = 8 + (score / 100) * 8;

          return (
            <CircleMarker
              key={venue.id}
              center={[venue.lat, venue.lng]}
              radius={radius}
              pathOptions={{
                fillColor:   cfg.color,
                fillOpacity: 0.9,
                color:       '#09090b',
                weight:      2,
              }}
            >
              <Popup minWidth={240} maxWidth={280}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold text-zinc-100 text-sm leading-tight">{venue.name}</h3>
                      <p className="text-zinc-400 text-xs mt-0.5">{venue.venue_type ?? 'Venue'} · {venue.city}</p>
                    </div>
                    <VibeScore score={venue.vibe_score} state={venue.vibe_state} size={56} />
                  </div>

                  <VibeBadge state={venue.vibe_state} />

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-zinc-400">
                    <div>
                      <span className="text-zinc-500 block">Address</span>
                      <span className="text-zinc-300">{venue.address}</span>
                    </div>
                    {venue.venue_type && (
                      <div>
                        <span className="text-zinc-500 block">Type</span>
                        <span className="text-zinc-300 capitalize">{venue.venue_type}</span>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/venue/${venue.id}`}
                    className="mt-3 block text-center text-xs font-semibold text-onda-purple hover:text-violet-300 transition-colors"
                  >
                    View details →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

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

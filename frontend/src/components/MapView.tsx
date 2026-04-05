'use client';
import L from 'leaflet';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { VIBE_STATE_CONFIG, type Venue } from '@/lib/types';

const KC: L.LatLngTuple = [39.0997, -94.5786];

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const [venues,  setVenues]  = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────
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

  // ── Supabase Realtime ────────────────────────────────────────────────────
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

  // ── Map init (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Delete any _leaflet_id left by a previous mount (StrictMode, HMR)
    // BEFORE calling L.map() so it never sees a pre-branded container.
    delete (el as unknown as Record<string, unknown>)._leaflet_id;

    const map = L.map(el, { center: KC, zoom: 13, zoomControl: false });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }
    ).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // runs once; cleanup handles HMR / StrictMode unmount

  // ── Markers (re-render on venue changes) ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || venues.length === 0) return;

    // Remove any existing circle markers
    map.eachLayer(layer => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    const lats: number[] = [];
    const lngs: number[] = [];

    venues.forEach(venue => {
      const cfg    = VIBE_STATE_CONFIG[venue.vibe_state];
      const score  = Math.round(venue.vibe_score);
      const radius = 8 + (score / 100) * 8;

      lats.push(venue.lat);
      lngs.push(venue.lng);

      const marker = L.circleMarker([venue.lat, venue.lng], {
        radius,
        fillColor:   cfg.color,
        fillOpacity: 0.9,
        color:       '#09090b',
        weight:      2,
      });

      marker.bindPopup(
        `<div style="min-width:220px;font-family:system-ui,sans-serif;color:#e4e4e7">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <strong style="font-size:14px;color:#f4f4f5">${venue.name}</strong>
              <div style="font-size:12px;color:#a1a1aa;margin-top:2px">
                ${venue.venue_type ?? 'Venue'} &middot; ${venue.city}
              </div>
            </div>
            <span style="
              font-size:18px;font-weight:700;color:${cfg.color};
              background:${cfg.color}22;border:1px solid ${cfg.color}44;
              border-radius:8px;padding:2px 8px;line-height:1.6
            ">${score}</span>
          </div>
          <span style="
            font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
            color:${cfg.color};background:${cfg.color}22;
            border:1px solid ${cfg.color}44;border-radius:999px;padding:2px 8px
          ">${cfg.label}</span>
          <div style="font-size:12px;color:#a1a1aa;margin-top:8px">${venue.address}</div>
          <a href="/venue/${venue.id}"
             style="display:block;margin-top:10px;text-align:center;font-size:12px;
                    font-weight:600;color:#a78bfa;text-decoration:none">
            View details →
          </a>
        </div>`,
        { maxWidth: 280, className: 'onda-popup' }
      );

      marker.addTo(map);
    });

    // Fit to all venues
    map.fitBounds([
      [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
      [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01],
    ]);
  }, [venues]);

  // ── Render ───────────────────────────────────────────────────────────────
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
      {/* Leaflet mounts directly into this div — no React wrapper */}
      <div ref={containerRef} className="h-full w-full" />

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

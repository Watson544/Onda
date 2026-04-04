'use client';
import dynamic from 'next/dynamic';

// Leaflet requires browser APIs – disable SSR, must be in a Client Component
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-onda-bg">
      <p className="text-zinc-400 animate-pulse">Loading map…</p>
    </div>
  ),
});

export default function HomePage() {
  return <MapView />;
}

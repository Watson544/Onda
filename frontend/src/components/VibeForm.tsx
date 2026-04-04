'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import clsx from 'clsx';

const GENRES = [
  'Hip Hop', 'R&B', 'Top 40', 'Electronic / EDM', 'House', 'Techno',
  'Country', 'Rock', 'Jazz', 'Latin', 'Reggaeton', 'Other',
];

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function Slider({ label, value, onChange }: SliderProps) {
  const labels = ['', 'Dead', 'Low', 'Mid', 'High', 'Lit'];
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="text-sm font-semibold text-onda-purple">{labels[value]}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={clsx(
              'flex-1 h-8 rounded-lg border transition-all text-xs font-medium',
              value >= n
                ? 'bg-onda-purple border-onda-purple text-zinc-950'
                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  venueId: string;
  onSuccess?: () => void;
}

export default function VibeForm({ venueId, onSuccess }: Props) {
  const { token, user } = useAuth();
  const [overall,  setOverall]  = useState(3);
  const [energy,   setEnergy]   = useState(3);
  const [music,    setMusic]    = useState(3);
  const [crowd,    setCrowd]    = useState(3);
  const [wait,     setWait]     = useState(0);
  const [genre,    setGenre]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [points,   setPoints]   = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError('Sign in to submit a vibe check.'); return; }
    setError('');
    setLoading(true);

    try {
      // Attempt GPS location
      let lat: number | undefined;
      let lng: number | undefined;
      let is_gps_verified = false;

      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        is_gps_verified = true;
      } catch { /* GPS denied – continue without */ }

      const result = await api.vibes.submit(
        { venue_id: venueId, overall_vibe: overall, energy_level: energy,
          music_quality: music, crowd_level: crowd, wait_time: wait,
          is_gps_verified, lat, lng },
        token
      ) as { points_earned?: number };

      setPoints(result.points_earned ?? null);
      setSuccess(true);
      onSuccess?.();

      // Reset after 3s
      setTimeout(() => { setSuccess(false); setPoints(null); }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit';
      setError(msg.includes('429') || msg.toLowerCase().includes('30 min')
        ? 'You already submitted a vibe for this venue recently. Try again in 30 minutes.'
        : msg);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="card p-5 text-center">
        <p className="text-zinc-400 text-sm">Sign in to submit a vibe check</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card p-6 text-center">
        <div className="text-4xl mb-2">🎉</div>
        <p className="font-semibold text-zinc-100">Vibe submitted!</p>
        {points !== null && (
          <p className="text-onda-teal text-sm mt-1">+{points} points earned</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <h3 className="font-semibold text-zinc-100">Submit Vibe Check</h3>

      <Slider label="Overall Vibe"   value={overall} onChange={setOverall} />
      <Slider label="Energy Level"   value={energy}  onChange={setEnergy}  />
      <Slider label="Music Quality"  value={music}   onChange={setMusic}   />
      <Slider label="Crowd Level"    value={crowd}   onChange={setCrowd}   />

      <div>
        <label className="text-sm text-zinc-300 block mb-1">Wait Time</label>
        <div className="flex items-center gap-3">
          <input
            type="range" min={0} max={60} step={5} value={wait}
            onChange={e => setWait(Number(e.target.value))}
            className="flex-1 accent-onda-purple"
          />
          <span className="text-sm text-zinc-400 w-16 text-right">
            {wait === 0 ? 'No wait' : `~${wait} min`}
          </span>
        </div>
      </div>

      <div>
        <label className="text-sm text-zinc-300 block mb-1">Music Genre</label>
        <select
          value={genre}
          onChange={e => setGenre(e.target.value)}
          className="input text-sm"
        >
          <option value="">Select genre…</option>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm text-zinc-300 block mb-1">
          Photo <span className="text-zinc-500 text-xs">(optional)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer border border-dashed border-zinc-700 rounded-xl px-4 py-3 hover:border-zinc-500 transition-colors">
          <span className="text-lg">📷</span>
          <span className="text-sm text-zinc-400">Tap to add a photo</span>
          <input type="file" accept="image/*" className="hidden" />
        </label>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Submitting…' : 'Submit Vibe ✨'}
      </button>
    </form>
  );
}

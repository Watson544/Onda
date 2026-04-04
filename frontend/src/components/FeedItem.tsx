import { formatDistanceToNow, parseISO } from 'date-fns';
import Link from 'next/link';
import type { VibeSubmission } from '@/lib/types';

const RATING_LABEL = ['', '💀', '😐', '🙂', '😊', '🔥'];

export default function FeedItem({ sub }: { sub: VibeSubmission }) {
  const ago = formatDistanceToNow(parseISO(sub.created_at), { addSuffix: true });

  return (
    <div className="card p-4 flex gap-3">
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm flex-shrink-0">
        🎶
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            {sub.venues ? (
              <Link href={`/venue/${sub.venues.id}`} className="font-medium text-sm text-zinc-100 hover:text-onda-purple transition-colors">
                {sub.venues.name}
              </Link>
            ) : (
              <span className="font-medium text-sm text-zinc-100">Unknown Venue</span>
            )}
            <span className="text-xs text-zinc-500 ml-2">{ago}</span>
          </div>
          <span className="text-lg flex-shrink-0">{RATING_LABEL[sub.overall_vibe]}</span>
        </div>

        {/* Rating pills */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { label: 'Vibe',   val: sub.overall_vibe  },
            { label: 'Energy', val: sub.energy_level  },
            { label: 'Music',  val: sub.music_quality },
            { label: 'Crowd',  val: sub.crowd_level   },
          ].map(({ label, val }) => (
            <span key={label} className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 text-xs text-zinc-300">
              <span className="text-zinc-500">{label}</span>
              <span className="font-semibold text-zinc-100">{val}/5</span>
            </span>
          ))}
          {sub.wait_time > 0 && (
            <span className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5 text-xs text-zinc-300">
              <span className="text-zinc-500">Wait</span>
              <span className="font-semibold text-zinc-100">~{sub.wait_time}m</span>
            </span>
          )}
          {sub.is_gps_verified && (
            <span className="inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 rounded-full px-2 py-0.5 text-xs text-onda-teal">
              📍 GPS
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

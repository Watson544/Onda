import { VIBE_STATE_CONFIG, type VibeState } from '@/lib/types';

interface Props {
  score: number;
  state: VibeState;
  size?: number;
}

export default function VibeScore({ score, state, size = 96 }: Props) {
  const cfg    = VIBE_STATE_CONFIG[state];
  const r      = (size / 2) - 8;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth={6} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={cfg.color} strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-zinc-100 leading-none">{Math.round(score)}</span>
        <span className="text-xs text-zinc-400 mt-0.5">vibe</span>
      </div>
    </div>
  );
}

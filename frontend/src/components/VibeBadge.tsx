import { VIBE_STATE_CONFIG, type VibeState } from '@/lib/types';
import clsx from 'clsx';

const DOTS: Record<VibeState, string> = {
  peaking:      'animate-ping',
  warming_up:   '',
  cooling_down: '',
  inactive:     '',
};

export default function VibeBadge({ state }: { state: VibeState }) {
  const cfg = VIBE_STATE_CONFIG[state];
  return (
    <span className={clsx('vibe-badge', cfg.bg, cfg.border, cfg.text)}>
      <span className="relative flex h-2 w-2">
        {DOTS[state] && (
          <span className={clsx('absolute inline-flex h-full w-full rounded-full opacity-75', DOTS[state])}
            style={{ backgroundColor: cfg.color }} />
        )}
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: cfg.color }} />
      </span>
      {cfg.label}
    </span>
  );
}

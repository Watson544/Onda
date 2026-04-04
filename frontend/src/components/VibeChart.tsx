'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { VIBE_STATE_CONFIG, type VibeHistory } from '@/lib/types';

interface Props { history: VibeHistory[] }

export default function VibeChart({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
        No history yet — be the first to submit a vibe!
      </div>
    );
  }

  const data = history.map(h => ({
    time:  format(parseISO(h.snapshot_at), 'h:mm a'),
    score: Math.round(h.vibe_score),
    state: h.vibe_state,
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="vibeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#141414', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#a1a1aa' }}
          itemStyle={{ color: '#a78bfa' }}
          formatter={(v: number) => [`${v}`, 'Score']}
        />
        <ReferenceLine y={50} stroke="#27272a" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#a78bfa"
          strokeWidth={2}
          fill="url(#vibeGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#a78bfa', stroke: '#09090b', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

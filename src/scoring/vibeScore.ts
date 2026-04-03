// ============================================================
// Onda – Vibe Scoring Engine
// ============================================================
//
// Weighted score formula:
//   base = overall_vibe(0.30) + energy_level(0.25) + music_quality(0.20)
//          + crowd_level(0.15) + wait_time_inv(0.10)
//
// Each raw dimension normalized to [0, 1]:
//   - Ratings 1-5  → (value - 1) / 4
//   - wait_time_inv → clamp(1 - wait_time / 60, 0, 1)
//
// Time decay: e^(-0.023 × age_minutes)   [half-life ≈ 30 min]
// Trust multiplier: 1.2× for GPS-verified submissions
//
// Final score: base × decay × trust × 100  (clamped to [0, 100])
//
// Vibe state thresholds (based on aggregated score):
//   inactive     < 20
//   warming_up   20 – 49
//   peaking      50 – 74
//   cooling_down 75+  (or declining — see deriveVibeState)
// ============================================================

import { supabase } from '../lib/supabase';
import { redis, venueScoreKey, REDIS_TTL } from '../lib/redis';
import { VibeState, VibeSubmissionInput, ComputedVibeScore, DbVibeSubmission } from '../types';

const WEIGHTS = {
  overall_vibe: 0.30,
  energy_level: 0.25,
  music_quality: 0.20,
  crowd_level: 0.15,
  wait_time_inv: 0.10,
} as const;

const DECAY_LAMBDA = 0.023;      // e^(-λt), t in minutes, half-life ≈ 30 min
const TRUST_MULTIPLIER = 1.2;    // GPS-verified bonus
const INACTIVITY_HOURS = 3;      // no submissions → inactive

// ---- Single-submission score (used for blending) ----

function scoreSingleSubmission(sub: VibeSubmissionInput): number {
  const normalizedRating = (v: number) => (v - 1) / 4;
  const waitInv = Math.max(0, Math.min(1, 1 - sub.wait_time / 60));

  const weighted =
    normalizedRating(sub.overall_vibe) * WEIGHTS.overall_vibe +
    normalizedRating(sub.energy_level) * WEIGHTS.energy_level +
    normalizedRating(sub.music_quality) * WEIGHTS.music_quality +
    normalizedRating(sub.crowd_level) * WEIGHTS.crowd_level +
    waitInv * WEIGHTS.wait_time_inv;

  const decay = Math.exp(-DECAY_LAMBDA * sub.age_minutes);
  const trust = sub.is_gps_verified ? TRUST_MULTIPLIER : 1.0;

  return weighted * decay * trust;
}

// ---- Derive vibe state from score + previous snapshot ----

export function deriveVibeState(
  score: number,
  previousScore?: number,
  hasRecentSubmissions = true
): VibeState {
  if (!hasRecentSubmissions || score < 20) return 'inactive';

  // Detect cooling trend: current score dropped >15% from previous snapshot
  if (previousScore !== undefined && score < previousScore * 0.85 && score >= 20) {
    return 'cooling_down';
  }

  if (score >= 50) return 'peaking';
  return 'warming_up';
}

// ---- Main export: compute score from all recent submissions for a venue ----

export async function computeVibeScore(venueId: string): Promise<ComputedVibeScore> {
  const cutoff = new Date(Date.now() - INACTIVITY_HOURS * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from('vibe_submissions')
    .select('*')
    .eq('venue_id', venueId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);

  const submissions = (rows ?? []) as DbVibeSubmission[];

  if (submissions.length === 0) {
    return { score: 0, vibe_state: 'inactive' };
  }

  const now = Date.now();
  let weightedSum = 0;
  let decaySum = 0;

  for (const sub of submissions) {
    const ageMs = now - new Date(sub.created_at).getTime();
    const ageMinutes = ageMs / 60_000;

    const input: VibeSubmissionInput = {
      overall_vibe: sub.overall_vibe,
      energy_level: sub.energy_level,
      music_quality: sub.music_quality,
      crowd_level: sub.crowd_level,
      wait_time: sub.wait_time,
      is_gps_verified: sub.is_gps_verified,
      age_minutes: ageMinutes,
    };

    const decay = Math.exp(-DECAY_LAMBDA * ageMinutes);
    const rawScore = scoreSingleSubmission(input);

    weightedSum += rawScore * decay;
    decaySum += decay;
  }

  // Decay-weighted mean, scaled to 0-100
  const rawMean = decaySum > 0 ? weightedSum / decaySum : 0;
  const score = Math.min(100, Math.max(0, Math.round(rawMean * 100)));

  // Fetch previous snapshot for trend detection
  const { data: histRow } = await supabase
    .from('venue_vibe_history')
    .select('vibe_score')
    .eq('venue_id', venueId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  const previousScore = histRow?.vibe_score as number | undefined;
  const vibe_state = deriveVibeState(score, previousScore, submissions.length > 0);

  return { score, vibe_state };
}

// ---- Persist score update + broadcast via Supabase Realtime ----

export async function persistAndBroadcastScore(
  venueId: string,
  score: number,
  vibe_state: VibeState
): Promise<void> {
  // 1. Update venues table
  const { error: updateErr } = await supabase
    .from('venues')
    .update({ vibe_score: score, vibe_state, updated_at: new Date().toISOString() })
    .eq('id', venueId);

  if (updateErr) {
    console.error(`[score] Failed to update venue ${venueId}:`, updateErr.message);
  }

  // 2. Cache in Redis for 120 seconds
  try {
    await redis.set(
      venueScoreKey(venueId),
      JSON.stringify({ score, vibe_state }),
      { ex: REDIS_TTL.VIBE_SCORE }
    );
  } catch (err) {
    console.error('[score] Redis cache write failed:', err);
  }

  // 3. Broadcast via Supabase Realtime (DB change listener on client side handles this
  //    automatically when using supabase.channel().on('postgres_changes',...)).
  //    The UPDATE on venues already triggers realtime for subscribed clients.
}

// ---- Trigger async recompute (non-blocking) ----

export function triggerAsyncRecompute(venueId: string): void {
  setImmediate(async () => {
    try {
      const { score, vibe_state } = await computeVibeScore(venueId);
      await persistAndBroadcastScore(venueId, score, vibe_state);
    } catch (err) {
      console.error(`[score] Async recompute failed for venue ${venueId}:`, err);
    }
  });
}

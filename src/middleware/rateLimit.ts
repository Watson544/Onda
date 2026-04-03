// ============================================================
// Rate limit helpers
// ============================================================
// Primary enforcement: query vibe_submissions for most-recent
// submission by (user_id, venue_id) within the last 30 minutes.
// Returns 429 with minutes_until_allowed in the response.
// ============================================================

import { supabase } from '../lib/supabase';

const WINDOW_MINUTES = 30;

export interface RateLimitResult {
  allowed: boolean;
  minutesUntilAllowed?: number;
}

export async function checkVibeRateLimit(
  userId: string,
  venueId: string
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('vibe_submissions')
    .select('created_at')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Fail open — let the request through if we can't check
    console.error('[rateLimit] DB check failed:', error.message);
    return { allowed: true };
  }

  if (!data) return { allowed: true };

  const lastAt = new Date(data.created_at).getTime();
  const nextAllowedAt = lastAt + WINDOW_MINUTES * 60 * 1000;
  const msRemaining = nextAllowedAt - Date.now();

  if (msRemaining <= 0) return { allowed: true };

  const minutesUntilAllowed = Math.ceil(msRemaining / 60_000);
  return { allowed: false, minutesUntilAllowed };
}

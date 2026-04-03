// ============================================================
// Cron job: Recompute vibe scores every 10 minutes
//
// Targets all venues that have had at least one submission
// in the past 3 hours, then snapshots to venue_vibe_history.
// ============================================================

import cron from 'node-cron';
import { supabase } from '../lib/supabase';
import { computeVibeScore, persistAndBroadcastScore } from '../scoring/vibeScore';

const ACTIVITY_WINDOW_HOURS = 3;

async function recomputeAllActiveVenues(): Promise<void> {
  const start = Date.now();
  const cutoff = new Date(Date.now() - ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Find distinct venue IDs with recent submissions
  const { data, error } = await supabase
    .from('vibe_submissions')
    .select('venue_id')
    .gte('created_at', cutoff);

  if (error) {
    console.error('[cron] Failed to fetch active venues:', error.message);
    return;
  }

  const venueIds = [...new Set((data ?? []).map((r: { venue_id: string }) => r.venue_id))];

  if (venueIds.length === 0) {
    console.log('[cron] No active venues to recompute.');
    return;
  }

  console.log(`[cron] Recomputing vibe scores for ${venueIds.length} venue(s)...`);

  const snapshots: Array<{ venue_id: string; vibe_score: number; vibe_state: string }> = [];

  await Promise.allSettled(
    venueIds.map(async (venueId) => {
      try {
        const { score, vibe_state } = await computeVibeScore(venueId);
        await persistAndBroadcastScore(venueId, score, vibe_state);
        snapshots.push({ venue_id: venueId, vibe_score: score, vibe_state });
      } catch (err) {
        console.error(`[cron] Failed for venue ${venueId}:`, err);
      }
    })
  );

  // Bulk insert history snapshots
  if (snapshots.length > 0) {
    const { error: histErr } = await supabase
      .from('venue_vibe_history')
      .insert(
        snapshots.map((s) => ({
          venue_id: s.venue_id,
          vibe_score: s.vibe_score,
          vibe_state: s.vibe_state,
          snapshot_at: new Date().toISOString(),
        }))
      );

    if (histErr) {
      console.error('[cron] Failed to insert vibe history:', histErr.message);
    }
  }

  const elapsed = Date.now() - start;
  console.log(
    `[cron] Recomputed ${snapshots.length}/${venueIds.length} venues in ${elapsed}ms`
  );
}

// Run every 10 minutes
export function startVibeRecomputeJob(): void {
  console.log('[cron] Vibe recompute job scheduled (every 10 minutes)');

  cron.schedule('*/10 * * * *', async () => {
    console.log(`[cron] Running vibe recompute at ${new Date().toISOString()}`);
    await recomputeAllActiveVenues();
  });
}

// ============================================================
// Vibes routes
//   POST /api/vibes                submit check-in, async recompute, award points
//   GET  /api/vibes/feed           recent submissions near location (paginated)
//   GET  /api/vibes/venue/:id      all recent vibes for a specific venue
// ============================================================

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { checkVibeRateLimit } from '../middleware/rateLimit';
import { triggerAsyncRecompute } from '../scoring/vibeScore';
import { DbVibeSubmission, ApiError } from '../types';

const router = Router();

const POINTS_PER_SUBMISSION = 10;
const POINTS_GPS_BONUS = 5;

// ---- POST /api/vibes ----
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const {
    venue_id,
    overall_vibe,
    energy_level,
    music_quality,
    crowd_level,
    wait_time,
    is_gps_verified,
    lat,
    lng,
  } = req.body as Partial<DbVibeSubmission>;

  // Input validation
  if (!venue_id) {
    res.status(400).json({ error: 'venue_id is required' } as ApiError);
    return;
  }

  const validateRating = (v: unknown, name: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return `${name} must be an integer between 1 and 5`;
    }
    return null;
  };

  const validationErrors = [
    validateRating(overall_vibe, 'overall_vibe'),
    validateRating(energy_level, 'energy_level'),
    validateRating(music_quality, 'music_quality'),
    validateRating(crowd_level, 'crowd_level'),
  ].filter(Boolean);

  if (validationErrors.length > 0) {
    res.status(400).json({ error: validationErrors[0] } as ApiError);
    return;
  }

  if (wait_time !== undefined && (typeof wait_time !== 'number' || wait_time < 0)) {
    res.status(400).json({ error: 'wait_time must be a non-negative number (minutes)' } as ApiError);
    return;
  }

  // 30-minute rate limit check
  const { allowed, minutesUntilAllowed } = await checkVibeRateLimit(userId, venue_id);
  if (!allowed) {
    res.status(429).json({
      error: 'You can only submit one vibe per venue every 30 minutes.',
      minutes_until_allowed: minutesUntilAllowed,
    });
    return;
  }

  // Verify venue exists
  const { data: venue, error: venueErr } = await supabase
    .from('venues')
    .select('id')
    .eq('id', venue_id)
    .single();

  if (venueErr || !venue) {
    res.status(404).json({ error: 'Venue not found' } as ApiError);
    return;
  }

  // Insert submission
  const { data: submission, error: insertErr } = await supabase
    .from('vibe_submissions')
    .insert({
      user_id: userId,
      venue_id,
      overall_vibe: Number(overall_vibe),
      energy_level: Number(energy_level),
      music_quality: Number(music_quality),
      crowd_level: Number(crowd_level),
      wait_time: Number(wait_time ?? 0),
      is_gps_verified: Boolean(is_gps_verified),
      lat: lat ?? null,
      lng: lng ?? null,
    })
    .select()
    .single();

  if (insertErr) {
    res.status(500).json({ error: insertErr.message } as ApiError);
    return;
  }

  // Award points (fire-and-forget)
  const pointsEarned =
    POINTS_PER_SUBMISSION + (is_gps_verified ? POINTS_GPS_BONUS : 0);

  supabase.rpc('increment_user_points', {
    p_user_id: userId,
    p_points: pointsEarned,
  }).then(({ error }) => {
    if (error) console.error('[vibes] Points RPC failed:', error.message);
  });

  // Trigger async score recompute — does NOT block the response
  triggerAsyncRecompute(venue_id);

  res.status(201).json({
    data: submission as DbVibeSubmission,
    points_earned: pointsEarned,
  });
});

// ---- GET /api/vibes/feed ----
// Query: lat, lng, radius_km (default 25), page (default 1), limit (default 20)
router.get('/feed', async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const limit = Math.min(50, parseInt((req.query.limit as string) ?? '20', 10));
  const offset = (page - 1) * limit;

  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data, error, count } = await supabase
    .from('vibe_submissions')
    .select(
      `*, venues(id, name, city, lat, lng, vibe_score, vibe_state)`,
      { count: 'exact' }
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
});

// ---- GET /api/vibes/venue/:id ----
router.get('/venue/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const limit = Math.min(50, parseInt((req.query.limit as string) ?? '20', 10));
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('vibe_submissions')
    .select('*')
    .eq('venue_id', id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.json({ data: data ?? [] });
});

export default router;

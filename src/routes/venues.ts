// ============================================================
// Venues routes
//   GET  /api/venues            map view, Redis-cached 60s
//   GET  /api/venues/:id        full detail + recent history
//   POST /api/venues            admin/owner only
//   PUT  /api/venues/:id        owner/admin only
//   GET  /api/venues/:id/history
// ============================================================

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { redis, venuesListKey, REDIS_TTL } from '../lib/redis';
import { requireAuth } from '../middleware/auth';
import { DbVenue, ApiError } from '../types';

const router = Router();

// ---- GET /api/venues ----
// Query params: city (required), lat, lng, radius_km (default 50)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const city = (req.query.city as string | undefined)?.trim();
  if (!city) {
    res.status(400).json({ error: 'city query parameter is required' } as ApiError);
    return;
  }

  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = parseFloat((req.query.radius_km as string) ?? '50');

  const cacheKey = venuesListKey(city);

  // Attempt Redis cache hit
  try {
    const cached = await redis.get<DbVenue[]>(cacheKey);
    if (cached) {
      res.json({ data: cached, cached: true });
      return;
    }
  } catch (err) {
    console.error('[venues] Redis get failed:', err);
  }

  let query = supabase
    .from('venues')
    .select('*')
    .ilike('city', city)
    .order('vibe_score', { ascending: false });

  // If lat/lng provided, apply bounding-box filter (approx radius)
  if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
    const degLat = radiusKm / 111.0;
    const degLng = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
    query = query
      .gte('lat', lat - degLat)
      .lte('lat', lat + degLat)
      .gte('lng', lng - degLng)
      .lte('lng', lng + degLng);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  const venues = (data ?? []) as DbVenue[];

  // Cache result
  try {
    await redis.set(cacheKey, venues, { ex: REDIS_TTL.VENUES_LIST });
  } catch (err) {
    console.error('[venues] Redis set failed:', err);
  }

  res.json({ data: venues, cached: false });
});

// ---- GET /api/venues/:id ----
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const [venueRes, histRes] = await Promise.all([
    supabase.from('venues').select('*').eq('id', id).single(),
    supabase
      .from('venue_vibe_history')
      .select('*')
      .eq('venue_id', id)
      .order('snapshot_at', { ascending: false })
      .limit(48),  // last ~8 hours of 10-min snapshots
  ]);

  if (venueRes.error || !venueRes.data) {
    res.status(404).json({ error: 'Venue not found' } as ApiError);
    return;
  }

  res.json({
    data: venueRes.data as DbVenue,
    history: histRes.data ?? [],
  });
});

// ---- POST /api/venues ----
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const {
    name, description, address, city, state, zip,
    lat, lng, phone, website, cover_image_url, venue_type,
    amount_cents, tier,
  } = req.body as Partial<DbVenue>;

  if (!name || !address || !city || lat == null || lng == null) {
    res.status(400).json({ error: 'name, address, city, lat, lng are required' } as ApiError);
    return;
  }

  const { data, error } = await supabase
    .from('venues')
    .insert({
      name,
      description,
      address,
      city,
      state,
      zip,
      lat,
      lng,
      phone,
      website,
      cover_image_url,
      venue_type,
      owner_id: userId,
      amount_cents: amount_cents ?? 1500,
      tier: tier ?? 'free',
      vibe_score: 0,
      vibe_state: 'inactive',
      is_verified: false,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.status(201).json({ data });
});

// ---- PUT /api/venues/:id ----
router.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { id } = req.params;

  // Verify ownership
  const { data: venue, error: fetchErr } = await supabase
    .from('venues')
    .select('owner_id')
    .eq('id', id)
    .single();

  if (fetchErr || !venue) {
    res.status(404).json({ error: 'Venue not found' } as ApiError);
    return;
  }

  if (venue.owner_id !== userId) {
    res.status(403).json({ error: 'Not authorized to update this venue' } as ApiError);
    return;
  }

  // Only allow safe fields to be updated by owners
  const {
    name, description, address, city, state, zip,
    phone, website, cover_image_url, venue_type,
    amount_cents, tier,
  } = req.body as Partial<DbVenue>;

  const { data, error } = await supabase
    .from('venues')
    .update({
      name,
      description,
      address,
      city,
      state,
      zip,
      phone,
      website,
      cover_image_url,
      venue_type,
      amount_cents,
      tier,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.json({ data });
});

// ---- GET /api/venues/:id/history ----
router.get('/:id/history', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const hours = Math.min(parseInt((req.query.hours as string) ?? '24', 10), 72);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('venue_vibe_history')
    .select('*')
    .eq('venue_id', id)
    .gte('snapshot_at', since)
    .order('snapshot_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.json({ data: data ?? [] });
});

export default router;

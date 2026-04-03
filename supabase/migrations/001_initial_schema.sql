-- ============================================================
-- Onda – Initial Schema Migration
-- All timestamps in UTC (TIMESTAMPTZ)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";   -- for geo queries (optional, lat/lng fallback used)

-- ============================================================
-- USERS
-- Mirrors auth.users; populated on first sign-in via trigger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  display_name          TEXT,
  avatar_url            TEXT,
  points                INTEGER NOT NULL DEFAULT 0,
  is_vip                BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Auto-create user profile on auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- VENUES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venues (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  description           TEXT,
  address               TEXT NOT NULL,
  city                  TEXT NOT NULL,
  state                 TEXT,
  zip                   TEXT,
  lat                   DOUBLE PRECISION NOT NULL,
  lng                   DOUBLE PRECISION NOT NULL,
  phone                 TEXT,
  website               TEXT,
  cover_image_url       TEXT,
  venue_type            TEXT,                          -- bar / club / lounge / rooftop / etc.
  vibe_score            DOUBLE PRECISION NOT NULL DEFAULT 0,
  vibe_state            TEXT NOT NULL DEFAULT 'inactive'
                          CHECK (vibe_state IN ('inactive','warming_up','peaking','cooling_down')),
  is_verified           BOOLEAN NOT NULL DEFAULT false,
  owner_id              UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount_cents          INTEGER NOT NULL DEFAULT 1500,  -- default skip-the-line pass price
  tier                  TEXT NOT NULL DEFAULT 'free'
                          CHECK (tier IN ('free','premium','elite')),
  stripe_account_id     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_city      ON public.venues(city);
CREATE INDEX IF NOT EXISTS idx_venues_owner     ON public.venues(owner_id);
CREATE INDEX IF NOT EXISTS idx_venues_vibe      ON public.venues(vibe_score DESC);
CREATE INDEX IF NOT EXISTS idx_venues_location  ON public.venues(lat, lng);

-- ============================================================
-- VENUE VIBE HISTORY  (10-minute snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_vibe_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id    UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  vibe_score  DOUBLE PRECISION NOT NULL,
  vibe_state  TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vvh_venue_time ON public.venue_vibe_history(venue_id, snapshot_at DESC);

-- ============================================================
-- SAVED VENUES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_venues (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  venue_id   UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_venues_user ON public.saved_venues(user_id);

-- ============================================================
-- VIBE SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vibe_submissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  venue_id        UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  overall_vibe    SMALLINT NOT NULL CHECK (overall_vibe BETWEEN 1 AND 5),
  energy_level    SMALLINT NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
  music_quality   SMALLINT NOT NULL CHECK (music_quality BETWEEN 1 AND 5),
  crowd_level     SMALLINT NOT NULL CHECK (crowd_level BETWEEN 1 AND 5),
  wait_time       SMALLINT NOT NULL DEFAULT 0 CHECK (wait_time >= 0),  -- minutes
  is_gps_verified BOOLEAN NOT NULL DEFAULT false,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index supports the 30-minute rate-limit query: find latest submission by user+venue
CREATE INDEX IF NOT EXISTS idx_vs_user_venue_time
  ON public.vibe_submissions(user_id, venue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vs_venue_time
  ON public.vibe_submissions(venue_id, created_at DESC);

-- ============================================================
-- SKIP PASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skip_passes (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  venue_id                  UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  pass_code                 TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','active','used','expired','refunded')),
  amount_cents              INTEGER NOT NULL,
  stripe_payment_intent_id  TEXT,
  qr_data                   TEXT,                  -- base64 PNG QR image
  redeemed_at               TIMESTAMPTZ,
  expires_at                TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passes_user   ON public.skip_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_passes_venue  ON public.skip_passes(venue_id);
CREATE INDEX IF NOT EXISTS idx_passes_code   ON public.skip_passes(pass_code);
CREATE INDEX IF NOT EXISTS idx_passes_stripe ON public.skip_passes(stripe_payment_intent_id);

-- ============================================================
-- updated_at auto-update trigger (shared)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at    ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_venues_updated_at   ON public.venues;
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_passes_updated_at   ON public.skip_passes;
CREATE TRIGGER trg_passes_updated_at
  BEFORE UPDATE ON public.skip_passes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_vibe_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_venues    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_passes     ENABLE ROW LEVEL SECURITY;

-- ---- users ----
-- Users can read and update only their own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ---- venues ----
-- Anyone can read venues
CREATE POLICY "venues_select_all" ON public.venues
  FOR SELECT USING (true);

-- Only owner or admin (service role bypasses RLS) can insert/update
CREATE POLICY "venues_insert_owner" ON public.venues
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "venues_update_owner" ON public.venues
  FOR UPDATE USING (auth.uid() = owner_id);

-- ---- venue_vibe_history ----
-- Publicly readable
CREATE POLICY "vvh_select_all" ON public.venue_vibe_history
  FOR SELECT USING (true);

-- ---- saved_venues ----
CREATE POLICY "saved_select_own" ON public.saved_venues
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_insert_own" ON public.saved_venues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_delete_own" ON public.saved_venues
  FOR DELETE USING (auth.uid() = user_id);

-- ---- vibe_submissions ----
-- Publicly readable
CREATE POLICY "vs_select_all" ON public.vibe_submissions
  FOR SELECT USING (true);

-- Insert requires auth
CREATE POLICY "vs_insert_auth" ON public.vibe_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- skip_passes ----
-- Readable by the purchasing user or the venue owner
CREATE POLICY "passes_select_user_or_owner" ON public.skip_passes
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id)
  );

CREATE POLICY "passes_insert_user" ON public.skip_passes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role used for status updates (webhook, redemption) — bypasses RLS automatically

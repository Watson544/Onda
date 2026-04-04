-- ============================================================
-- Onda – Safe idempotent migration
-- Run this if 001 partially applied (tables exist, policies errored).
-- Drops each policy before recreating — safe to run multiple times.
-- Also ensures triggers, functions, and RLS are in place.
-- ============================================================

-- ── RLS: enable on all tables (idempotent) ───────────────────
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_vibe_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_venues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skip_passes        ENABLE ROW LEVEL SECURITY;

-- ── users policies ───────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ── venues policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "venues_select_all" ON public.venues;
CREATE POLICY "venues_select_all" ON public.venues
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "venues_insert_owner" ON public.venues;
CREATE POLICY "venues_insert_owner" ON public.venues
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "venues_update_owner" ON public.venues;
CREATE POLICY "venues_update_owner" ON public.venues
  FOR UPDATE USING (auth.uid() = owner_id);

-- ── venue_vibe_history policies ──────────────────────────────
DROP POLICY IF EXISTS "vvh_select_all" ON public.venue_vibe_history;
CREATE POLICY "vvh_select_all" ON public.venue_vibe_history
  FOR SELECT USING (true);

-- ── saved_venues policies ────────────────────────────────────
DROP POLICY IF EXISTS "saved_select_own" ON public.saved_venues;
CREATE POLICY "saved_select_own" ON public.saved_venues
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_insert_own" ON public.saved_venues;
CREATE POLICY "saved_insert_own" ON public.saved_venues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_delete_own" ON public.saved_venues;
CREATE POLICY "saved_delete_own" ON public.saved_venues
  FOR DELETE USING (auth.uid() = user_id);

-- ── vibe_submissions policies ────────────────────────────────
DROP POLICY IF EXISTS "vs_select_all" ON public.vibe_submissions;
CREATE POLICY "vs_select_all" ON public.vibe_submissions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "vs_insert_auth" ON public.vibe_submissions;
CREATE POLICY "vs_insert_auth" ON public.vibe_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── skip_passes policies ─────────────────────────────────────
DROP POLICY IF EXISTS "passes_select_user_or_owner" ON public.skip_passes;
CREATE POLICY "passes_select_user_or_owner" ON public.skip_passes
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT owner_id FROM public.venues WHERE id = venue_id)
  );

DROP POLICY IF EXISTS "passes_insert_user" ON public.skip_passes;
CREATE POLICY "passes_insert_user" ON public.skip_passes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── updated_at trigger function (CREATE OR REPLACE = idempotent) ─
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at  ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_passes_updated_at ON public.skip_passes;
CREATE TRIGGER trg_passes_updated_at
  BEFORE UPDATE ON public.skip_passes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── handle_new_user trigger (CREATE OR REPLACE = idempotent) ─
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

-- ── increment_user_points RPC ────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_user_points(p_user_id UUID, p_points INTEGER)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.users
  SET points     = points + p_points,
      updated_at = NOW()
  WHERE id = p_user_id;
$$;

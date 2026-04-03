-- ============================================================
-- Onda – RPC helper functions
-- ============================================================

-- Increment user points atomically
CREATE OR REPLACE FUNCTION public.increment_user_points(p_user_id UUID, p_points INTEGER)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.users
  SET points = points + p_points,
      updated_at = NOW()
  WHERE id = p_user_id;
$$;

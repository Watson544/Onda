import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Service-role client — bypasses RLS, used in server-side operations
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

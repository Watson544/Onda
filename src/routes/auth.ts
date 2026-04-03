// ============================================================
// Auth route — thin wrapper used by the venue scanner PWA
//   POST /api/auth/login   → validates credentials via Supabase Auth
// ============================================================

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const router = Router();

// Use anon key for sign-in (not service role)
const anonClient = createClient(
  config.supabase.url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? config.supabase.serviceRoleKey
);

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    res.status(401).json({ error: error?.message ?? 'Authentication failed' });
    return;
  }

  res.json({
    access_token: data.session.access_token,
    expires_at: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
});

export default router;

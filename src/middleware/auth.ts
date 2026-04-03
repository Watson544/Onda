// ============================================================
// Auth middleware – verifies Supabase JWT from Authorization header
// Sets req.userId on success
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ApiError } from '../types';

// Extend Express Request to carry the authenticated user id
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Anon-key client used only for JWT verification (not data access)
const authClient = createClient(
  config.supabase.url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? config.supabase.serviceRoleKey
);

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' } as ApiError);
    return;
  }

  const token = authHeader.slice(7);

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' } as ApiError);
    return;
  }

  req.userId = data.user.id;
  next();
}

// Optional auth — attaches userId if present, continues regardless
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await authClient.auth.getUser(token);
    if (data.user) req.userId = data.user.id;
  }
  next();
}

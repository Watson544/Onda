// ============================================================
// Users routes
//   GET  /api/users/me
//   PUT  /api/users/me
//   POST /api/users/save-venue
//   POST /api/users/subscribe/vip
// ============================================================

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { stripe, STRIPE_PRICES } from '../lib/stripe';
import { requireAuth } from '../middleware/auth';
import { DbUser, ApiError } from '../types';

const router = Router();

// ---- GET /api/users/me ----
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const { data, error } = await supabase
    .from('users')
    .select('*, saved_venues(venue_id, venues(id, name, city, vibe_score, vibe_state))')
    .eq('id', userId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'User not found' } as ApiError);
    return;
  }

  res.json({ data: data as DbUser });
});

// ---- PUT /api/users/me ----
router.put('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const { display_name, avatar_url } = req.body as Pick<DbUser, 'display_name' | 'avatar_url'>;

  const { data, error } = await supabase
    .from('users')
    .update({ display_name, avatar_url })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.json({ data: data as DbUser });
});

// ---- POST /api/users/save-venue ----
router.post('/save-venue', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { venue_id, action } = req.body as { venue_id?: string; action?: 'save' | 'unsave' };

  if (!venue_id) {
    res.status(400).json({ error: 'venue_id is required' } as ApiError);
    return;
  }

  if (action === 'unsave') {
    const { error } = await supabase
      .from('saved_venues')
      .delete()
      .eq('user_id', userId)
      .eq('venue_id', venue_id);

    if (error) {
      res.status(500).json({ error: error.message } as ApiError);
      return;
    }

    res.json({ success: true, action: 'unsaved' });
    return;
  }

  // Default: save
  const { data, error } = await supabase
    .from('saved_venues')
    .upsert({ user_id: userId, venue_id }, { onConflict: 'user_id,venue_id' })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.status(201).json({ success: true, action: 'saved', data });
});

// ---- POST /api/users/subscribe/vip ----
// Creates a Stripe Checkout Session or Subscription for $4.99/mo VIP
router.post('/subscribe/vip', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('stripe_customer_id, email, is_vip')
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    res.status(404).json({ error: 'User not found' } as ApiError);
    return;
  }

  if (user.is_vip) {
    res.status(409).json({ error: 'User is already a VIP subscriber' } as ApiError);
    return;
  }

  // Ensure Stripe customer exists
  let stripeCustomerId = user.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email as string,
      metadata: { supabase_user_id: userId },
    });
    stripeCustomerId = customer.id;
    await supabase.from('users').update({ stripe_customer_id: stripeCustomerId }).eq('id', userId);
  }

  if (!STRIPE_PRICES.VIP_MONTHLY) {
    res.status(500).json({ error: 'VIP subscription price not configured' } as ApiError);
    return;
  }

  // Create subscription — customer must have a payment method attached first
  // Typically this is done client-side; here we return the subscription object
  let subscription;
  try {
    subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: STRIPE_PRICES.VIP_MONTHLY }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { supabase_user_id: userId },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe subscription error';
    res.status(502).json({ error: msg } as ApiError);
    return;
  }

  const invoice = subscription.latest_invoice as {
    payment_intent?: { client_secret?: string };
  } | null;

  res.status(201).json({
    subscription_id: subscription.id,
    client_secret: invoice?.payment_intent?.client_secret ?? null,
  });
});

export default router;

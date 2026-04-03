// ============================================================
// Skip Passes routes
//   POST /api/passes/create-intent   create Stripe Payment Intent, reserve slot
//   GET  /api/passes/:id             pass status + QR data
//   GET  /api/passes/user/mine       user's pass history
//   POST /api/passes/redeem          venue staff scans — atomic optimistic lock
//
// Stripe webhook (payment_intent.succeeded → activate pass):
//   POST /api/stripe/webhook         (separate file, mounted at root)
// ============================================================

import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { stripe, platformFeeAmount } from '../lib/stripe';
import { requireAuth } from '../middleware/auth';
import { DbSkipPass, PassStatus, ApiError } from '../types';

const router = Router();

// Pass expires 6 hours after creation
const PASS_EXPIRY_HOURS = 6;

// ---- validatePass helper ----
interface ValidationResult {
  valid: boolean;
  reason?: string;
  pass?: DbSkipPass;
}

async function validatePass(passId: string): Promise<ValidationResult> {
  const { data, error } = await supabase
    .from('skip_passes')
    .select('*')
    .eq('id', passId)
    .single();

  if (error || !data) return { valid: false, reason: 'Pass not found' };

  const pass = data as DbSkipPass;
  const now = new Date();

  switch (pass.status as PassStatus) {
    case 'pending':
      return { valid: false, reason: 'Payment has not been completed yet' };
    case 'used':
      return { valid: false, reason: 'Pass has already been redeemed' };
    case 'expired':
      return { valid: false, reason: 'Pass has expired' };
    case 'refunded':
      return { valid: false, reason: 'Pass has been refunded' };
    case 'active':
      break;
    default:
      return { valid: false, reason: 'Unknown pass status' };
  }

  if (now > new Date(pass.expires_at)) {
    // Mark expired in DB (best-effort)
    supabase
      .from('skip_passes')
      .update({ status: 'expired' })
      .eq('id', passId)
      .then(() => {});

    return { valid: false, reason: 'Pass has expired' };
  }

  return { valid: true, pass };
}

// ---- redeemPass helper (atomic optimistic lock) ----
interface RedeemResult {
  success: boolean;
  reason?: string;
}

async function redeemPass(passId: string): Promise<RedeemResult> {
  const validation = await validatePass(passId);
  if (!validation.valid) {
    return { success: false, reason: validation.reason };
  }

  // Atomic update: only succeeds if status is still 'active'
  // This prevents double-scan race conditions
  const { data, error } = await supabase
    .from('skip_passes')
    .update({ status: 'used', redeemed_at: new Date().toISOString() })
    .eq('id', passId)
    .eq('status', 'active')          // ← optimistic lock
    .select()
    .single();

  if (error || !data) {
    return {
      success: false,
      reason: 'Pass could not be redeemed — it may have just been used',
    };
  }

  return { success: true };
}

// ---- POST /api/passes/create-intent ----
router.post('/create-intent', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { venue_id } = req.body as { venue_id?: string };

  if (!venue_id) {
    res.status(400).json({ error: 'venue_id is required' } as ApiError);
    return;
  }

  // Fetch venue for price + Stripe account
  const { data: venue, error: venueErr } = await supabase
    .from('venues')
    .select('id, name, amount_cents, stripe_account_id')
    .eq('id', venue_id)
    .single();

  if (venueErr || !venue) {
    res.status(404).json({ error: 'Venue not found' } as ApiError);
    return;
  }

  // Fetch or create Stripe customer for user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('stripe_customer_id, email')
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    res.status(404).json({ error: 'User not found' } as ApiError);
    return;
  }

  let stripeCustomerId = user.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email as string,
      metadata: { supabase_user_id: userId },
    });
    stripeCustomerId = customer.id;
    await supabase.from('users').update({ stripe_customer_id: stripeCustomerId }).eq('id', userId);
  }

  // Generate a unique pass code before creating the intent
  const passCode = uuidv4();
  const expiresAt = new Date(Date.now() + PASS_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  // Create Stripe Payment Intent
  const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
    amount: venue.amount_cents as number,
    currency: 'usd',
    customer: stripeCustomerId,
    metadata: {
      venue_id,
      user_id: userId,
      pass_code: passCode,
    },
  };

  // If venue has a Stripe Connect account, split revenue 80/20
  if (venue.stripe_account_id) {
    intentParams.application_fee_amount = platformFeeAmount(venue.amount_cents as number);
    intentParams.transfer_data = { destination: venue.stripe_account_id as string };
  }

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create(intentParams);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    res.status(502).json({ error: msg } as ApiError);
    return;
  }

  // Generate QR code PNG as base64 data URL
  let qrData: string;
  try {
    qrData = await QRCode.toDataURL(passCode);
  } catch {
    qrData = '';
  }

  // Reserve the pass in DB (status = 'pending' until webhook activates)
  const { data: pass, error: passErr } = await supabase
    .from('skip_passes')
    .insert({
      user_id: userId,
      venue_id,
      pass_code: passCode,
      status: 'pending',
      amount_cents: venue.amount_cents,
      stripe_payment_intent_id: paymentIntent.id,
      qr_data: qrData,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (passErr || !pass) {
    res.status(500).json({ error: passErr?.message ?? 'Failed to create pass' } as ApiError);
    return;
  }

  res.status(201).json({
    data: pass as DbSkipPass,
    client_secret: paymentIntent.client_secret,
  });
});

// ---- GET /api/passes/user/mine ----
// Must be before /:id to avoid route collision
router.get('/user/mine', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const { data, error } = await supabase
    .from('skip_passes')
    .select('*, venues(id, name, address, city)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    res.status(500).json({ error: error.message } as ApiError);
    return;
  }

  res.json({ data: data ?? [] });
});

// ---- GET /api/passes/:id ----
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { id } = req.params;

  const { data, error } = await supabase
    .from('skip_passes')
    .select('*, venues(id, name, address, city, owner_id)')
    .eq('id', id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'Pass not found' } as ApiError);
    return;
  }

  const pass = data as DbSkipPass & { venues: { owner_id: string } };

  // Only the purchasing user or venue owner can view
  if (pass.user_id !== userId && pass.venues?.owner_id !== userId) {
    res.status(403).json({ error: 'Not authorized' } as ApiError);
    return;
  }

  res.json({ data: pass });
});

// ---- POST /api/passes/redeem ----
router.post('/redeem', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { pass_code } = req.body as { pass_code?: string };

  if (!pass_code) {
    res.status(400).json({ error: 'pass_code is required' } as ApiError);
    return;
  }

  // Look up pass by code
  const { data: passRow, error: lookupErr } = await supabase
    .from('skip_passes')
    .select('*, venues(owner_id)')
    .eq('pass_code', pass_code)
    .single();

  if (lookupErr || !passRow) {
    res.status(404).json({ error: 'Pass not found' } as ApiError);
    return;
  }

  const pass = passRow as DbSkipPass & { venues: { owner_id: string } };

  // Only venue owner (staff) can redeem
  if (pass.venues?.owner_id !== userId) {
    res.status(403).json({ error: 'Not authorized to redeem passes for this venue' } as ApiError);
    return;
  }

  const result = await redeemPass(pass.id);

  if (!result.success) {
    res.status(422).json({ error: result.reason } as ApiError);
    return;
  }

  res.json({ success: true, message: 'Pass redeemed successfully' });
});

export default router;

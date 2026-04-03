// ============================================================
// Stripe webhook handler
//   POST /api/stripe/webhook
//
// Handles:
//   payment_intent.succeeded   → activate skip pass
//   customer.subscription.updated / deleted → update user VIP status
// ============================================================

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { config } from '../config';

const router = Router();

// Raw body needed for Stripe signature verification — mounted BEFORE express.json()
router.post(
  '/',
  // express.raw() applied in index.ts for this specific route
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'] as string | undefined;

    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Webhook verification failed';
      console.error('[webhook] Signature verification failed:', msg);
      res.status(400).json({ error: msg });
      return;
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;

        default:
          // Silently acknowledge unhandled events
          break;
      }
    } catch (err) {
      console.error(`[webhook] Handler error for ${event.type}:`, err);
      // Still return 200 — Stripe will retry on 5xx only
    }

    res.json({ received: true });
  }
);

// ---- payment_intent.succeeded → activate pass ----
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const passCode = pi.metadata?.pass_code;
  if (!passCode) {
    console.warn('[webhook] payment_intent.succeeded missing pass_code metadata:', pi.id);
    return;
  }

  const { error } = await supabase
    .from('skip_passes')
    .update({ status: 'active' })
    .eq('stripe_payment_intent_id', pi.id)
    .eq('status', 'pending');   // idempotent — only update if still pending

  if (error) {
    console.error('[webhook] Failed to activate pass for PI:', pi.id, error.message);
    throw error;
  }

  console.log(`[webhook] Pass activated for PI ${pi.id}`);
}

// ---- payment_intent.payment_failed → keep pending (customer can retry) ----
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  // No action needed — pass stays 'pending' until expires_at
  console.log(`[webhook] Payment failed for PI ${pi.id}`);
}

// ---- subscription change → update user VIP / venue tier ----
async function handleSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const isActive = sub.status === 'active' || sub.status === 'trialing';

  const priceId = sub.items.data[0]?.price?.id ?? '';

  const vipPriceId = process.env.STRIPE_PRICE_VIP_MONTHLY ?? '';

  if (priceId === vipPriceId) {
    // VIP user subscription
    const { error } = await supabase
      .from('users')
      .update({
        is_vip: isActive,
        stripe_subscription_id: isActive ? sub.id : null,
      })
      .eq('stripe_customer_id', customerId);

    if (error) console.error('[webhook] Failed to update VIP status:', error.message);
  } else {
    // Venue tier subscription — map price to tier
    const premiumPriceId = process.env.STRIPE_PRICE_VENUE_PREMIUM ?? '';
    const elitePriceId = process.env.STRIPE_PRICE_VENUE_ELITE ?? '';

    let tier = 'free';
    if (isActive && priceId === premiumPriceId) tier = 'premium';
    if (isActive && priceId === elitePriceId) tier = 'elite';

    const { error } = await supabase
      .from('venues')
      .update({ tier })
      .eq('stripe_account_id', customerId);

    if (error) console.error('[webhook] Failed to update venue tier:', error.message);
  }
}

export default router;

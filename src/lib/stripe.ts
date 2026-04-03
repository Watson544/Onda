import Stripe from 'stripe';
import { config } from '../config';

export const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

// Subscription price IDs — create these in your Stripe dashboard and set here
export const STRIPE_PRICES = {
  VIP_MONTHLY: process.env.STRIPE_PRICE_VIP_MONTHLY ?? '',          // $4.99/mo
  VENUE_PREMIUM: process.env.STRIPE_PRICE_VENUE_PREMIUM ?? '',      // $99/mo
  VENUE_ELITE: process.env.STRIPE_PRICE_VENUE_ELITE ?? '',          // $299/mo
} as const;

// Revenue split: 80% to venue via Stripe Connect, 20% platform fee
export const PLATFORM_FEE_PERCENT = 20;

export function platformFeeAmount(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

// ============================================================
// Onda – Cold Start Seed Script
// Run: npm run seed
//
// Seeds 20 Kansas City venues with is_verified=true,
// vibe_score=30 (baseline), vibe_state='warming_up'
// ============================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const venues = [
  {
    name: 'The Rooftop at Power & Light',
    description: 'Open-air rooftop bar with panoramic views of the KC skyline.',
    address: '1337 Main St', city: 'Kansas City', state: 'MO', zip: '64105',
    lat: 39.0997, lng: -94.5786, venue_type: 'rooftop', amount_cents: 1500, tier: 'premium',
  },
  {
    name: 'Manifest Distilling',
    description: 'Craft cocktail bar inside a converted warehouse with live music.',
    address: '1520 Genessee St', city: 'Kansas City', state: 'MO', zip: '64102',
    lat: 39.1048, lng: -94.5922, venue_type: 'bar', amount_cents: 1200, tier: 'free',
  },
  {
    name: 'The Drum Room',
    description: 'Intimate jazz and blues lounge in the heart of the Hotel Phillips.',
    address: '106 W 12th St', city: 'Kansas City', state: 'MO', zip: '64105',
    lat: 39.1016, lng: -94.5793, venue_type: 'lounge', amount_cents: 1000, tier: 'free',
  },
  {
    name: 'Proof Bar',
    description: 'Sleek craft cocktail bar with rotating artisanal spirits list.',
    address: '1931 Wyandotte St', city: 'Kansas City', state: 'MO', zip: '64108',
    lat: 39.0888, lng: -94.5803, venue_type: 'bar', amount_cents: 1200, tier: 'free',
  },
  {
    name: 'recordBar',
    description: 'Legendary live music venue and bar in Westport.',
    address: '1020 Westport Rd', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0436, lng: -94.5938, venue_type: 'club', amount_cents: 2000, tier: 'premium',
  },
  {
    name: 'Westport Saloon',
    description: 'Classic Westport dive bar with strong pours and local regulars.',
    address: '4108 Pennsylvania Ave', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0429, lng: -94.5940, venue_type: 'bar', amount_cents: 800, tier: 'free',
  },
  {
    name: 'The Brick',
    description: 'Historic venue in Westport with two-level dance floor and rooftop.',
    address: '1727 McGee St', city: 'Kansas City', state: 'MO', zip: '64108',
    lat: 39.0871, lng: -94.5821, venue_type: 'club', amount_cents: 1500, tier: 'premium',
  },
  {
    name: 'KC Live! Block',
    description: 'Outdoor entertainment complex in the Power & Light District.',
    address: '1310 Baltimore Ave', city: 'Kansas City', state: 'MO', zip: '64105',
    lat: 39.0987, lng: -94.5791, venue_type: 'rooftop', amount_cents: 1000, tier: 'free',
  },
  {
    name: "Tom's Town Distilling",
    description: 'Prohibition-era inspired cocktail bar in the Crossroads.',
    address: '1701 Main St', city: 'Kansas City', state: 'MO', zip: '64108',
    lat: 39.0859, lng: -94.5786, venue_type: 'lounge', amount_cents: 1200, tier: 'premium',
  },
  {
    name: 'Coda',
    description: 'Upscale rooftop lounge with craft cocktails and city views.',
    address: '101 W 22nd St', city: 'Kansas City', state: 'MO', zip: '64108',
    lat: 39.0837, lng: -94.5803, venue_type: 'rooftop', amount_cents: 1800, tier: 'elite',
  },
  {
    name: "Voltaire",
    description: "KC Crossroads' favorite late-night cocktail bar.",
    address: '4013 Mill St', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0435, lng: -94.5947, venue_type: 'bar', amount_cents: 1000, tier: 'free',
  },
  {
    name: "Johnny's Tavern Westport",
    description: 'Sports bar with great beer selection and lively atmosphere.',
    address: '4139 Pennsylvania Ave', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0432, lng: -94.5942, venue_type: 'bar', amount_cents: 800, tier: 'free',
  },
  {
    name: 'The Ship',
    description: 'Nautical-themed cocktail bar with late-night bites.',
    address: '1221 Union Ave', city: 'Kansas City', state: 'MO', zip: '64101',
    lat: 39.1069, lng: -94.5946, venue_type: 'bar', amount_cents: 1000, tier: 'free',
  },
  {
    name: 'Hop Cat Kansas City',
    description: 'Massive craft beer bar with over 100 taps.',
    address: '406 Westport Rd', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0444, lng: -94.5956, venue_type: 'bar', amount_cents: 800, tier: 'free',
  },
  {
    name: 'Char Bar',
    description: 'BBQ-meets-bar concept with outdoor fire pits and smoked cocktails.',
    address: '4050 Penn Valley Dr', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0420, lng: -94.5898, venue_type: 'bar', amount_cents: 1200, tier: 'premium',
  },
  {
    name: 'Boulevard Brewing Taproom',
    description: 'Legendary KC craft brewery with full bar and live events.',
    address: '2534 Madison Ave', city: 'Kansas City', state: 'MO', zip: '64108',
    lat: 39.0841, lng: -94.5836, venue_type: 'bar', amount_cents: 1000, tier: 'free',
  },
  {
    name: 'KC Improv Comedy Club',
    description: 'Stand-up and improv shows with full bar.',
    address: '7340 W 80th St', city: 'Overland Park', state: 'KS', zip: '66204',
    lat: 38.9889, lng: -94.6702, venue_type: 'lounge', amount_cents: 1500, tier: 'free',
  },
  {
    name: "Musetta's",
    description: 'Intimate wine bar with rotating live jazz sets.',
    address: '3900 Broadway Blvd', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0461, lng: -94.5919, venue_type: 'lounge', amount_cents: 1000, tier: 'free',
  },
  {
    name: 'The Sundry',
    description: 'Modern cocktail lounge in the Crossroads Arts District.',
    address: '2101 Central St', city: 'Kansas City', state: 'MO', zip: '64108',
    lat: 39.0848, lng: -94.5812, venue_type: 'lounge', amount_cents: 1200, tier: 'premium',
  },
  {
    name: "Harling's Upstairs",
    description: "Beloved Westport dance bar playing '80s and '90s hits.",
    address: '3941 Pennsylvania Ave', city: 'Kansas City', state: 'MO', zip: '64111',
    lat: 39.0440, lng: -94.5938, venue_type: 'club', amount_cents: 1500, tier: 'premium',
  },
];

async function seed(): Promise<void> {
  console.log(`Seeding ${venues.length} Kansas City venues...`);

  const rows = venues.map((v) => ({
    ...v,
    vibe_score: 30,
    vibe_state: 'warming_up',
    is_verified: true,
  }));

  const { data, error } = await supabase
    .from('venues')
    .upsert(rows, { onConflict: 'name,city' })  // idempotent on re-run
    .select('id, name');

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log('Seeded venues:');
  (data ?? []).forEach((v: { id: string; name: string }) => {
    console.log(`  ${v.id}  ${v.name}`);
  });

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

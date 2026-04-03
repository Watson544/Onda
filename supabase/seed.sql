-- ============================================================
-- Onda – Cold Start Seed  (20 Kansas City venues)
-- Run after 001_initial_schema.sql
-- vibe_score = 30 (baseline), vibe_state = 'warming_up', is_verified = true
-- ============================================================

INSERT INTO public.venues (
  name, description, address, city, state, zip,
  lat, lng, venue_type, vibe_score, vibe_state,
  is_verified, amount_cents, tier
) VALUES
  (
    'The Rooftop at Power & Light',
    'Open-air rooftop bar with panoramic views of the KC skyline.',
    '1337 Main St', 'Kansas City', 'MO', '64105',
    39.0997, -94.5786, 'rooftop', 30, 'warming_up', true, 1500, 'premium'
  ),
  (
    'Manifest Distilling',
    'Craft cocktail bar inside a converted warehouse with live music.',
    '1520 Genessee St', 'Kansas City', 'MO', '64102',
    39.1048, -94.5922, 'bar', 30, 'warming_up', true, 1200, 'free'
  ),
  (
    'The Drum Room',
    'Intimate jazz and blues lounge in the heart of the Hotel Phillips.',
    '106 W 12th St', 'Kansas City', 'MO', '64105',
    39.1016, -94.5793, 'lounge', 30, 'warming_up', true, 1000, 'free'
  ),
  (
    'Proof Bar',
    'Sleek craft cocktail bar with rotating artisanal spirits list.',
    '1931 Wyandotte St', 'Kansas City', 'MO', '64108',
    39.0888, -94.5803, 'bar', 30, 'warming_up', true, 1200, 'free'
  ),
  (
    'recordBar',
    'Legendary live music venue and bar in Westport.',
    '1020 Westport Rd', 'Kansas City', 'MO', '64111',
    39.0436, -94.5938, 'club', 30, 'warming_up', true, 2000, 'premium'
  ),
  (
    'Westport Saloon',
    'Classic Westport dive bar with strong pours and local regulars.',
    '4108 Pennsylvania Ave', 'Kansas City', 'MO', '64111',
    39.0429, -94.5940, 'bar', 30, 'warming_up', true, 800, 'free'
  ),
  (
    'The Brick',
    'Historic venue in Westport with two-level dance floor and rooftop.',
    '1727 McGee St', 'Kansas City', 'MO', '64108',
    39.0871, -94.5821, 'club', 30, 'warming_up', true, 1500, 'premium'
  ),
  (
    'KC Live! Block',
    'Outdoor entertainment complex in the Power & Light District.',
    '1310 Baltimore Ave', 'Kansas City', 'MO', '64105',
    39.0987, -94.5791, 'rooftop', 30, 'warming_up', true, 1000, 'free'
  ),
  (
    'Tom's Town Distilling',
    'Prohibition-era inspired cocktail bar in the Crossroads.',
    '1701 Main St', 'Kansas City', 'MO', '64108',
    39.0859, -94.5786, 'lounge', 30, 'warming_up', true, 1200, 'premium'
  ),
  (
    'Coda',
    'Upscale rooftop lounge with craft cocktails and city views.',
    '101 W 22nd St', 'Kansas City', 'MO', '64108',
    39.0837, -94.5803, 'rooftop', 30, 'warming_up', true, 1800, 'elite'
  ),
  (
    'Voltaire',
    'KC Crossroads'' favorite late-night cocktail bar.',
    '4013 Mill St', 'Kansas City', 'MO', '64111',
    39.0435, -94.5947, 'bar', 30, 'warming_up', true, 1000, 'free'
  ),
  (
    'Johnny's Tavern Westport',
    'Sports bar with great beer selection and lively atmosphere.',
    '4139 Pennsylvania Ave', 'Kansas City', 'MO', '64111',
    39.0432, -94.5942, 'bar', 30, 'warming_up', true, 800, 'free'
  ),
  (
    'The Ship',
    'Nautical-themed cocktail bar with late-night bites.',
    '1221 Union Ave', 'Kansas City', 'MO', '64101',
    39.1069, -94.5946, 'bar', 30, 'warming_up', true, 1000, 'free'
  ),
  (
    'Hop Cat Kansas City',
    'Massive craft beer bar with over 100 taps.',
    '406 Westport Rd', 'Kansas City', 'MO', '64111',
    39.0444, -94.5956, 'bar', 30, 'warming_up', true, 800, 'free'
  ),
  (
    'Char Bar',
    'BBQ-meets-bar concept with outdoor fire pits and smoked cocktails.',
    '4050 Penn Valley Dr', 'Kansas City', 'MO', '64111',
    39.0420, -94.5898, 'bar', 30, 'warming_up', true, 1200, 'premium'
  ),
  (
    'Boulevard Brewing Taproom',
    'Legendary KC craft brewery with full bar and live events.',
    '2534 Madison Ave', 'Kansas City', 'MO', '64108',
    39.0841, -94.5836, 'bar', 30, 'warming_up', true, 1000, 'free'
  ),
  (
    'KC Improv Comedy Club',
    'Stand-up and improv shows with full bar.',
    '7340 W 80th St', 'Overland Park', 'KS', '66204',
    38.9889, -94.6702, 'lounge', 30, 'warming_up', true, 1500, 'free'
  ),
  (
    'Musetta's',
    'Intimate wine bar with rotating live jazz sets.',
    '3900 Broadway Blvd', 'Kansas City', 'MO', '64111',
    39.0461, -94.5919, 'lounge', 30, 'warming_up', true, 1000, 'free'
  ),
  (
    'The Sundry',
    'Modern cocktail lounge in the Crossroads Arts District.',
    '2101 Central St', 'Kansas City', 'MO', '64108',
    39.0848, -94.5812, 'lounge', 30, 'warming_up', true, 1200, 'premium'
  ),
  (
    'Harling's Upstairs',
    'Beloved Westport dance bar playing '80s and '90s hits.',
    '3941 Pennsylvania Ave', 'Kansas City', 'MO', '64111',
    39.0440, -94.5938, 'club', 30, 'warming_up', true, 1500, 'premium'
  );

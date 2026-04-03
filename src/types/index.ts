// ============================================================
// Onda – Shared TypeScript types
// ============================================================

export type VibeState = 'inactive' | 'warming_up' | 'peaking' | 'cooling_down';
export type PassStatus = 'pending' | 'active' | 'used' | 'expired' | 'refunded';
export type VenueTier = 'free' | 'premium' | 'elite';

// ---- Database row types ----

export interface DbVenue {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string | null;
  zip: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  cover_image_url: string | null;
  venue_type: string | null;
  vibe_score: number;
  vibe_state: VibeState;
  is_verified: boolean;
  owner_id: string | null;
  amount_cents: number;
  tier: VenueTier;
  stripe_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbVibeHistory {
  id: string;
  venue_id: string;
  vibe_score: number;
  vibe_state: VibeState;
  snapshot_at: string;
}

export interface DbUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  points: number;
  is_vip: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSavedVenue {
  id: string;
  user_id: string;
  venue_id: string;
  created_at: string;
}

export interface DbVibeSubmission {
  id: string;
  user_id: string;
  venue_id: string;
  overall_vibe: number;
  energy_level: number;
  music_quality: number;
  crowd_level: number;
  wait_time: number;
  is_gps_verified: boolean;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface DbSkipPass {
  id: string;
  user_id: string;
  venue_id: string;
  pass_code: string;
  status: PassStatus;
  amount_cents: number;
  stripe_payment_intent_id: string | null;
  qr_data: string | null;
  redeemed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// ---- Scoring types ----

export interface VibeSubmissionInput {
  overall_vibe: number;    // 1-5
  energy_level: number;    // 1-5
  music_quality: number;   // 1-5
  crowd_level: number;     // 1-5
  wait_time: number;       // minutes
  is_gps_verified: boolean;
  age_minutes: number;     // how old is this submission
}

export interface ComputedVibeScore {
  score: number;           // 0-100
  vibe_state: VibeState;
}

// ---- API response helpers ----

export interface ApiError {
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

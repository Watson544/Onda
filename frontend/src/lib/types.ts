export type VibeState = 'inactive' | 'warming_up' | 'peaking' | 'cooling_down';
export type PassStatus = 'pending' | 'active' | 'used' | 'expired' | 'refunded';
export type VenueTier  = 'free' | 'premium' | 'elite';

export interface Venue {
  id:              string;
  name:            string;
  description:     string | null;
  address:         string;
  city:            string;
  state:           string | null;
  zip:             string | null;
  lat:             number;
  lng:             number;
  phone:           string | null;
  website:         string | null;
  cover_image_url: string | null;
  venue_type:      string | null;
  vibe_score:      number;
  vibe_state:      VibeState;
  is_verified:     boolean;
  owner_id:        string | null;
  amount_cents:    number;
  tier:            VenueTier;
  created_at:      string;
  updated_at:      string;
}

export interface VibeHistory {
  id:          string;
  venue_id:    string;
  vibe_score:  number;
  vibe_state:  VibeState;
  snapshot_at: string;
}

export interface VibeSubmission {
  id:              string;
  user_id:         string;
  venue_id:        string;
  overall_vibe:    number;
  energy_level:    number;
  music_quality:   number;
  crowd_level:     number;
  wait_time:       number;
  is_gps_verified: boolean;
  lat:             number | null;
  lng:             number | null;
  created_at:      string;
  venues?:         Pick<Venue, 'id' | 'name' | 'city' | 'vibe_score' | 'vibe_state'>;
}

export interface UserProfile {
  id:                    string;
  email:                 string;
  display_name:          string | null;
  avatar_url:            string | null;
  points:                number;
  is_vip:                boolean;
  stripe_customer_id:    string | null;
  stripe_subscription_id: string | null;
  created_at:            string;
  updated_at:            string;
}

export const VIBE_STATE_CONFIG: Record<VibeState, { label: string; color: string; pinColor: string; bg: string; border: string; text: string }> = {
  peaking:      { label: 'Peaking',      color: '#10b981', pinColor: '#10b981', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  warming_up:   { label: 'Warming Up',   color: '#f59e0b', pinColor: '#f59e0b', bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400'   },
  cooling_down: { label: 'Cooling Down', color: '#ef4444', pinColor: '#ef4444', bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400'     },
  inactive:     { label: 'Inactive',     color: '#6b7280', pinColor: '#6b7280', bg: 'bg-zinc-700/15',    border: 'border-zinc-700/30',    text: 'text-zinc-400'    },
};

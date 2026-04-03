import { Redis } from '@upstash/redis';
import { config } from '../config';

export const redis = new Redis({
  url: config.redis.url,
  token: config.redis.token,
});

// TTLs in seconds
export const REDIS_TTL = {
  VENUES_LIST: 60,      // GET /api/venues map view
  VIBE_SCORE: 120,      // computed vibe score per venue
} as const;

export function venueScoreKey(venueId: string): string {
  return `vibe:score:${venueId}`;
}

export function venuesListKey(city: string): string {
  return `venues:list:${city.toLowerCase().replace(/\s+/g, '_')}`;
}

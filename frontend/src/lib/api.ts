const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res  = await fetch(`${API}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

export const api = {
  venues: {
    list: (city = 'Kansas City') =>
      apiFetch<{ data: import('./types').Venue[] }>(`/api/venues?city=${encodeURIComponent(city)}`),
    get: (id: string) =>
      apiFetch<{ data: import('./types').Venue; history: import('./types').VibeHistory[] }>(`/api/venues/${id}`),
    history: (id: string, hours = 24) =>
      apiFetch<{ data: import('./types').VibeHistory[] }>(`/api/venues/${id}/history?hours=${hours}`),
  },

  vibes: {
    submit: (body: Record<string, unknown>, token: string) =>
      apiFetch('/api/vibes', { method: 'POST', body: JSON.stringify(body) }, token),
    feed: (page = 1, limit = 20) =>
      apiFetch<{ data: import('./types').VibeSubmission[]; total: number; page: number; limit: number }>(
        `/api/vibes/feed?page=${page}&limit=${limit}`
      ),
    forVenue: (id: string) =>
      apiFetch<{ data: import('./types').VibeSubmission[] }>(`/api/vibes/venue/${id}`),
  },

  users: {
    me: (token: string) =>
      apiFetch<{ data: import('./types').UserProfile }>('/api/users/me', {}, token),
    update: (body: Record<string, unknown>, token: string) =>
      apiFetch('/api/users/me', { method: 'PUT', body: JSON.stringify(body) }, token),
    saveVenue: (venue_id: string, action: 'save' | 'unsave', token: string) =>
      apiFetch('/api/users/save-venue', { method: 'POST', body: JSON.stringify({ venue_id, action }) }, token),
  },
};

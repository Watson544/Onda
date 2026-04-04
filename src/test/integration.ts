// ============================================================
// Onda – Integration test harness (no external services needed)
// Uses require.cache pre-population to inject in-memory mocks
// before route files are loaded, avoiding any module recursion.
//
// Run: npx ts-node src/test/integration.ts
// ============================================================

// Step 0 – env must be set before config module loads
process.env.SUPABASE_URL              = 'https://placeholder.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'placeholder-service-key';
process.env.UPSTASH_REDIS_URL         = 'https://placeholder.upstash.io';
process.env.UPSTASH_REDIS_TOKEN       = 'placeholder-token';
process.env.STRIPE_SECRET_KEY         = 'sk_test_' + 'x'.repeat(48);
process.env.STRIPE_WEBHOOK_SECRET     = 'whsec_placeholder';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';
process.env.PORT                      = '3099';

import path   from 'path';
import http   from 'http';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

// ─── In-memory database ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const db: Record<string, Row[]> = {
  venues:             [],
  users:              [],
  vibe_submissions:   [],
  venue_vibe_history: [],
  saved_venues:       [],
  skip_passes:        [],
};

const TEST_USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

db.users.push({
  id:           TEST_USER_ID,
  email:        'test@onda.app',
  display_name: 'Test User',
  avatar_url:   null,
  points:       0,
  is_vip:       false,
  stripe_customer_id:   null,
  stripe_subscription_id: null,
  created_at:   new Date().toISOString(),
  updated_at:   new Date().toISOString(),
});

// ─── Query builder (fluent, in-memory) ────────────────────────────────────────

function makeQueryBuilder(table: string) {
  const state = {
    filters:    [] as Array<(r: Row) => boolean>,
    orderCol:   null as string | null,
    orderAsc:   true,
    limitN:     null as number | null,
    rangeFrom:  0,
    rangeTo:    Infinity,
    isSingle:   false,
    isMaybe:    false,
    wantCount:  false,
    mode:       'select' as 'select' | 'insert' | 'upsert' | 'update' | 'delete',
    payload:    null as Row | Row[] | null,
  };

  const b: any = {
    select(_cols?: any, opts?: any) { if (opts?.count) state.wantCount = true; return b; },
    insert(d: Row | Row[]) { state.mode = 'insert'; state.payload = d; return b; },
    upsert(d: Row | Row[], _opts?: any) { state.mode = 'upsert'; state.payload = d; return b; },
    update(d: Row) { state.mode = 'update'; state.payload = d; return b; },
    delete() { state.mode = 'delete'; return b; },
    eq(col: string, val: unknown) { state.filters.push(r => r[col] === val); return b; },
    gte(col: string, val: unknown) { state.filters.push(r => String(r[col]) >= String(val)); return b; },
    lte(col: string, val: unknown) { state.filters.push(r => String(r[col]) <= String(val)); return b; },
    ilike(col: string, val: string) { state.filters.push(r => String(r[col]).toLowerCase().includes(val.toLowerCase())); return b; },
    order(col: string, opts?: any) { state.orderCol = col; state.orderAsc = opts?.ascending !== false; return b; },
    limit(n: number) { state.limitN = n; return b; },
    range(from: number, to: number) { state.rangeFrom = from; state.rangeTo = to; return b; },
    single() { state.isSingle = true; return b; },
    maybeSingle() { state.isMaybe = true; return b; },
    then(resolve: (v: any) => void) { resolve(execute()); },
  };

  function matches(r: Row) { return state.filters.every(f => f(r)); }

  function execute(): any {
    // INSERT
    if (state.mode === 'insert') {
      const rows = (Array.isArray(state.payload) ? state.payload : [state.payload!]).map(d => ({
        id: uuidv4(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...d,
      }));
      rows.forEach(r => db[table].push(r));
      const out = state.isSingle ? rows[0] : rows;
      return { data: out ?? null, error: null };
    }

    // UPSERT
    if (state.mode === 'upsert') {
      const rows = (Array.isArray(state.payload) ? state.payload : [state.payload!]).map(d => ({
        id: uuidv4(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...d,
      }));
      rows.forEach(r => db[table].push(r));
      const out = state.isSingle ? rows[0] : rows;
      return { data: out ?? null, error: null };
    }

    // UPDATE
    if (state.mode === 'update') {
      db[table] = db[table].map(r =>
        matches(r) ? { ...r, ...state.payload, updated_at: new Date().toISOString() } : r
      );
      const updated = db[table].filter(matches);
      return { data: state.isSingle ? (updated[0] ?? null) : updated, error: null };
    }

    // DELETE
    if (state.mode === 'delete') {
      db[table] = db[table].filter(r => !matches(r));
      return { data: null, error: null };
    }

    // SELECT
    let rows = db[table].filter(matches);
    if (state.orderCol) {
      const col = state.orderCol;
      rows = rows.sort((a, b) => {
        if (a[col] == null) return 1; if (b[col] == null) return -1;
        return state.orderAsc ? (a[col]! < b[col]! ? -1 : 1) : (a[col]! > b[col]! ? -1 : 1);
      });
    }
    if (state.rangeFrom || state.rangeTo < Infinity) rows = rows.slice(state.rangeFrom, state.rangeTo + 1);
    if (state.limitN !== null) rows = rows.slice(0, state.limitN);

    if (state.isSingle) {
      if (!rows[0]) return { data: null, error: { message: 'No rows', code: 'PGRST116' } };
      return { data: rows[0], error: null };
    }
    if (state.isMaybe) return { data: rows[0] ?? null, error: null };
    if (state.wantCount) return { data: rows, error: null, count: rows.length };
    return { data: rows, error: null };
  }

  return b;
}

// ─── Mock modules ─────────────────────────────────────────────────────────────

const mockSupabaseExports = {
  supabase: {
    from: (table: string) => makeQueryBuilder(table),
    rpc: (_fn: string, args: any) => {
      // increment_user_points
      if (_fn === 'increment_user_points' && args?.p_user_id) {
        const u = db.users.find(r => r.id === args.p_user_id);
        if (u) u.points = (u.points as number) + (args.p_points as number);
      }
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getUser: async (token: string) =>
        token === 'test-token'
          ? { data: { user: { id: TEST_USER_ID, email: 'test@onda.app' } }, error: null }
          : { data: { user: null }, error: { message: 'Bad token' } },
    },
  },
};

const mockRedisExports = {
  redis: { get: async () => null, set: async () => 'OK' },
  REDIS_TTL: { VENUES_LIST: 60, VIBE_SCORE: 120 },
  venueScoreKey: (id: string) => `vibe:score:${id}`,
  venuesListKey: (city: string) => `venues:list:${city}`,
};

const mockAuthExports = {
  requireAuth: (req: any, _res: any, next: Function) => { req.userId = TEST_USER_ID; next(); },
  optionalAuth: (req: any, _res: any, next: Function) => { req.userId = TEST_USER_ID; next(); },
};

// ─── Inject mocks into require.cache BEFORE loading routes ───────────────────

function fakeModule(filePath: string, exports: any): NodeModule {
  return {
    id: filePath, filename: filePath, loaded: true,
    exports, children: [], parent: null, paths: [],
    require: require,
    path: path.dirname(filePath),
    isPreloading: false,
  } as any;
}

// resolve() only finds the file path – it does NOT execute the module
const supabasePath = require.resolve('../lib/supabase');
const redisPath    = require.resolve('../lib/redis');
const authPath     = require.resolve('../middleware/auth');

require.cache[supabasePath] = fakeModule(supabasePath, mockSupabaseExports);
require.cache[redisPath]    = fakeModule(redisPath,    mockRedisExports);
require.cache[authPath]     = fakeModule(authPath,     mockAuthExports);

// ─── Load routes (they will pull mocks from cache above) ─────────────────────

const venuesRouter = require('../routes/venues').default;
const vibesRouter  = require('../routes/vibes').default;

// ─── Express test app ────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/venues', venuesRouter);
app.use('/api/vibes',  vibesRouter);

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function req(method: string, urlPath: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts: http.RequestOptions = {
      hostname: 'localhost', port: 3099, path: urlPath, method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function ok(label: string, detail?: any) {
  console.log(`  ✓  ${label}`);
  if (detail !== undefined) console.log(`       ${JSON.stringify(detail)}`);
  passed++;
}

function fail(label: string, detail?: any) {
  console.error(`  ✗  ${label}`);
  if (detail !== undefined) console.error(`       ${JSON.stringify(detail)}`);
  failed++;
}

function assert(cond: boolean, label: string, detail?: any) {
  cond ? ok(label, detail) : fail(label, detail);
}

async function run() {
  let venueId = '';

  // ── Test 1: Create a venue ────────────────────────────────────────────────
  console.log('\n── 1. POST /api/venues ──────────────────────────────────');
  {
    const r = await req('POST', '/api/venues', {
      name: 'Rooftop Test Bar', description: 'A test venue',
      address: '123 Test St', city: 'Kansas City', state: 'MO',
      lat: 39.0997, lng: -94.5786, venue_type: 'rooftop',
      amount_cents: 1500, tier: 'free',
    });
    assert(r.status === 201, `Status 201 (got ${r.status})`, r.body);
    if (r.status === 201) {
      venueId = r.body.data.id;
      const v = r.body.data;
      assert(v.name === 'Rooftop Test Bar', 'name correct');
      assert(v.owner_id === TEST_USER_ID,   'owner_id = test user');
      assert(v.vibe_score === 0,            `initial vibe_score=0 (got ${v.vibe_score})`);
      assert(v.vibe_state === 'inactive',   `initial vibe_state=inactive (got ${v.vibe_state})`);
    }
  }

  if (!venueId) { console.error('\nCannot continue – venue creation failed.\n'); process.exit(1); }

  // ── Validation: missing required fields ───────────────────────────────────
  {
    const r = await req('POST', '/api/venues', { name: 'Incomplete Venue' });
    assert(r.status === 400, `Missing fields → 400 (got ${r.status})`, r.body.error);
  }

  // ── Test 2: Submit a vibe check ───────────────────────────────────────────
  console.log('\n── 2. POST /api/vibes ───────────────────────────────────');
  {
    const r = await req('POST', '/api/vibes', {
      venue_id:     venueId,
      overall_vibe: 4,
      energy_level: 5,
      music_quality: 4,
      crowd_level:  3,
      wait_time:    10,
      is_gps_verified: true,
      lat: 39.0997,
      lng: -94.5786,
    });
    assert(r.status === 201, `Status 201 (got ${r.status})`, r.body);
    if (r.status === 201) {
      assert(r.body.data.venue_id  === venueId,   'submission venue_id correct');
      assert(r.body.data.user_id   === TEST_USER_ID, 'submission user_id correct');
      assert(r.body.points_earned  === 15,        `points_earned=15 GPS bonus (got ${r.body.points_earned})`);
    }
  }

  // ── Validation: out-of-range rating ───────────────────────────────────────
  {
    const r = await req('POST', '/api/vibes', {
      venue_id: venueId, overall_vibe: 6 /* invalid */,
      energy_level: 3, music_quality: 3, crowd_level: 3, wait_time: 0,
    });
    assert(r.status === 400, `Out-of-range rating → 400 (got ${r.status})`, r.body.error);
  }

  // ── Rate limit: second submission within 30 min ───────────────────────────
  {
    const r = await req('POST', '/api/vibes', {
      venue_id: venueId, overall_vibe: 4, energy_level: 4,
      music_quality: 4, crowd_level: 4, wait_time: 5,
    });
    assert(r.status === 429, `Rate limit → 429 (got ${r.status})`, r.body.error);
    if (r.status === 429) {
      assert(
        typeof r.body.minutes_until_allowed === 'number' && r.body.minutes_until_allowed > 0,
        `minutes_until_allowed present (got ${r.body.minutes_until_allowed})`
      );
    }
  }

  // Wait briefly for async score recompute (triggerAsyncRecompute uses setImmediate)
  await new Promise(res => setTimeout(res, 300));

  // ── Test 3: Verify vibe score updated on venue ────────────────────────────
  console.log('\n── 3. GET /api/venues/:id (score updated?) ──────────────');
  {
    const r = await req('GET', `/api/venues/${venueId}`);
    assert(r.status === 200, `Status 200 (got ${r.status})`, r.body);
    if (r.status === 200) {
      const v = r.body.data;
      assert(v.vibe_score > 0,    `vibe_score > 0 (got ${v.vibe_score})`);
      assert(
        ['warming_up','peaking','cooling_down','inactive'].includes(v.vibe_state),
        `vibe_state valid (got "${v.vibe_state}")`
      );
      console.log(`\n     Score: ${v.vibe_score}  State: ${v.vibe_state}`);
    }
  }

  // ── Scoring math sanity check (pure, no HTTP) ─────────────────────────────
  console.log('\n── 4. Scoring engine sanity check ───────────────────────');
  {
    // Import scoring module (supabase is mocked so it resolves ok)
    const { deriveVibeState } = require('../scoring/vibeScore');
    assert(deriveVibeState(10)                === 'inactive',     'score=10  → inactive');
    assert(deriveVibeState(30)                === 'warming_up',   'score=30  → warming_up');
    assert(deriveVibeState(60)                === 'peaking',      'score=60  → peaking');
    assert(deriveVibeState(60, 80)            === 'cooling_down', 'score=60, prev=80 → cooling_down');
    assert(deriveVibeState(55, undefined, false) === 'inactive',  'no recent activity → inactive');
  }

  // ── Feed endpoint ─────────────────────────────────────────────────────────
  console.log('\n── 5. GET /api/vibes/feed ───────────────────────────────');
  {
    const r = await req('GET', '/api/vibes/feed?page=1&limit=10');
    assert(r.status === 200, `Status 200 (got ${r.status})`);
    assert(Array.isArray(r.body.data), 'data is array');
    assert(typeof r.body.total === 'number', `total is number (got ${r.body.total})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

const server = app.listen(3099, () => {
  run().catch(err => {
    console.error('\nTest runner crashed:', err);
    server.close();
    process.exit(1);
  }).finally(() => server.close());
});

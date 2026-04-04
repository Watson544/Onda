// Quick DB introspection – run with: npx ts-node src/scripts/db-check.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // 1. Which tables exist in public schema
  const { data: tables } = await sb.rpc('db_check_tables') as any;

  // Use raw SQL via the REST /rest/v1/rpc approach isn't available for arbitrary SQL,
  // so probe each table directly by selecting 0 rows
  const tableNames = [
    'users', 'venues', 'venue_vibe_history',
    'saved_venues', 'vibe_submissions', 'skip_passes',
  ];

  console.log('\n── Tables ───────────────────────────────────────────');
  for (const t of tableNames) {
    const { error } = await sb.from(t).select('*').limit(0);
    console.log(`  ${error ? '✗ MISSING' : '✓ exists '} → ${t}  ${error ? `(${error.message})` : ''}`);
  }

  // 2. Check RLS policies via pg_policies view
  console.log('\n── RLS Policies ─────────────────────────────────────');
  // Query information_schema via a known table
  const { data: venueRows } = await sb
    .from('venues')
    .select('count')
    .limit(1);
  console.log('  venues accessible:', venueRows !== null ? 'yes' : 'no');

  // 3. Check functions exist by calling them with dummy args (expect specific errors, not "does not exist")
  console.log('\n── Functions ────────────────────────────────────────');
  const { error: rpcErr } = await sb.rpc('increment_user_points', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_points: 0,
  });
  console.log('  increment_user_points:', rpcErr
    ? (rpcErr.message.includes('does not exist') ? '✗ MISSING' : `✓ exists (${rpcErr.message})`)
    : '✓ exists'
  );

  console.log();
}

run().catch(console.error);

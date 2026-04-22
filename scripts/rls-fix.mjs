#!/usr/bin/env node
/**
 * RLS Security Fix — Supabase
 *
 * 1. Probes REST API to discover which tables actually exist
 * 2. Generates a targeted SQL migration enabling RLS + policies
 * 3. Attempts execution via Supabase Management API (needs SUPABASE_ACCESS_TOKEN)
 *    Falls back: prints SQL to copy-paste into the Supabase SQL editor
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Credentials ──────────────────────────────────────────────────────────────
const SUPABASE_URL    = 'https://esoogmdwzcarvlodwbue.supabase.co';
const SERVICE_ROLE    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF     = 'esoogmdwzcarvlodwbue';
// Optional: set SUPABASE_ACCESS_TOKEN env var for automated execution
const PAT             = process.env.SUPABASE_ACCESS_TOKEN;

// ── All candidate tables (from codebase scan + CLAUDE.md) ────────────────────
const ALL_TABLES = [
  // Orders & production
  'orders', 'order_items', 'squarespace_orders',
  // Contacts & heroes
  'contacts', 'heroes', 'hero_associations',
  // Financials
  'donations', 'disbursements', 'expenses', 'statements',
  // Events
  'events', 'event_tasks', 'event_sponsors', 'event_budget_items',
  // GYST personal finance (ALL service_role only)
  'gyst_transactions', 'gyst_accounts', 'gyst_plaid_items',
  'gyst_properties', 'gyst_property_costs', 'gyst_debts',
  'gyst_income_sources', 'gyst_budget_categories', 'gyst_action_items',
  'gyst_monthly_snapshots',
  // Tasks & ops
  'tasks', 'users', 'volunteers', 'organizations',
  // Communication
  'family_messages', 'engagements', 'decisions', 'open_questions',
  'anniversary_emails',
  // Anniversaries & tracking
  'anniversary_status',
  // Chat & AI
  'chat_sessions', 'chat_messages', 'hb_messages', 'claude_sessions',
  // Logs & stream
  'context_log', 'execution_log', 'engagement_log', 'org_stream',
  'friction_logs', 'sop_executions', 'sf_sync_log', 'knowledge_audit_log',
  // Knowledge
  'knowledge_files', 'org_knowledge_artifacts', 'platform_knowledge_pool',
  // HonorBase platform
  'honorbase_orgs', 'org_members', 'hb_dashboard_cards', 'build_queue',
  // Properties & config
  'properties', 'system_config',
  // Compliance
  'compliance_items', 'compliance_documents',
  // Misc
  'closeouts', 'initiatives',
  'social_media_posts', 'social_media_profile_snapshots',
];

// Tables that should allow anonymous READ (public website content)
const PUBLIC_READ_TABLES = new Set(['heroes', 'family_messages']);

// ── Probe: which tables actually exist? ───────────────────────────────────────
async function probeTables() {
  console.log(`\nProbing ${ALL_TABLES.length} candidate tables via REST API…`);
  const existing = [];
  const missing  = [];

  await Promise.all(ALL_TABLES.map(async (table) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=0`;
    const res = await fetch(url, {
      headers: {
        'apikey':        SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
      },
    });

    if (res.ok || res.status === 416) {
      existing.push(table);
    } else {
      const body = await res.text().catch(() => '');
      if (body.includes('42P01') || body.includes('does not exist') || res.status === 404) {
        missing.push(table);
      } else {
        // Other errors (likely exists but access denied or RLS kicks in)
        existing.push(table);
      }
    }
  }));

  existing.sort();
  missing.sort();

  console.log(`\n✓ Existing tables (${existing.length}):`);
  existing.forEach(t => console.log(`  - ${t}`));

  if (missing.length) {
    console.log(`\n✗ Not found / will skip (${missing.length}):`);
    missing.forEach(t => console.log(`  - ${t}`));
  }

  return existing;
}

// ── SQL generation ────────────────────────────────────────────────────────────
function generateSQL(tables) {
  const lines = [
    '-- ============================================================',
    '-- RLS Security Migration — Supabase Project A (HonorBase)',
    `-- Generated: ${new Date().toISOString()}`,
    '-- Enables Row Level Security on ALL public tables.',
    '-- Service role has full access to every table.',
    '-- heroes + family_messages allow anonymous SELECT for the website.',
    '-- gyst_plaid_items (contains Plaid access tokens) is strict service_role only.',
    '-- ============================================================',
    '',
    '-- ── Step 1: Enable RLS on all existing tables ─────────────────',
  ];

  for (const t of tables) {
    lines.push(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
  }

  lines.push('', '-- ── Step 2: Drop ALL existing policies (idempotent + fixes overly permissive ones) ─');
  lines.push('-- The original schema created "Allow all for authenticated" (USING TRUE) on all');
  lines.push('-- tables — that exposes everything to the anon key. Drop it here.');
  for (const t of tables) {
    lines.push(`DROP POLICY IF EXISTS "Allow all for authenticated" ON public.${t};`);
    lines.push(`DROP POLICY IF EXISTS "service_role_all" ON public.${t};`);
    if (PUBLIC_READ_TABLES.has(t)) {
      lines.push(`DROP POLICY IF EXISTS "anon_read" ON public.${t};`);
    }
  }

  lines.push('', '-- ── Step 3: Service-role full-access policy for ALL tables ──────');
  lines.push('-- The app always uses the service_role key server-side, so this');
  lines.push('-- policy ensures no server operation is accidentally blocked.');
  for (const t of tables) {
    lines.push(
      `CREATE POLICY "service_role_all" ON public.${t}`,
      `  FOR ALL USING (auth.role() = 'service_role');`,
      '',
    );
  }

  lines.push('-- ── Step 4: Public read for website-facing tables ────────────────');
  for (const t of [...PUBLIC_READ_TABLES]) {
    if (tables.includes(t)) {
      lines.push(
        `CREATE POLICY "anon_read" ON public.${t}`,
        `  FOR SELECT USING (true);`,
        '',
      );
    }
  }

  lines.push(
    '-- ── Step 5: Verify ───────────────────────────────────────────────',
    'SELECT',
    '  tablename,',
    '  rowsecurity AS rls_enabled',
    'FROM pg_tables',
    "WHERE schemaname = 'public'",
    'ORDER BY tablename;',
    '',
  );

  return lines.join('\n');
}

// ── Execute via Supabase Management API ───────────────────────────────────────
async function executeSQL(sql) {
  if (!PAT) {
    return null; // skip — no PAT available
  }

  console.log('\nAttempting execution via Supabase Management API…');
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  if (res.ok) {
    const data = await res.json();
    return { ok: true, data };
  } else {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  Supabase RLS Security Fix');
  console.log('══════════════════════════════════════════════════════');

  const existing = await probeTables();

  if (existing.length === 0) {
    console.error('\n✗ No tables found — check credentials');
    process.exit(1);
  }

  const sql = generateSQL(existing);

  const outPath = join(__dirname, '..', 'supabase', 'migrations', '004_enable_rls.sql');
  writeFileSync(outPath, sql, 'utf8');
  console.log(`\n✓ Migration written to: supabase/migrations/004_enable_rls.sql`);

  // Try automated execution
  const result = await executeSQL(sql);

  if (result?.ok) {
    console.log('\n✓ Migration EXECUTED successfully via Management API');
    console.log('  Verification result:');
    const rows = result.data;
    if (Array.isArray(rows)) {
      rows.forEach(r => console.log(`  ${r.tablename.padEnd(40)} rls=${r.rls_enabled}`));
    }
  } else {
    if (result) {
      console.log(`\n⚠ Management API execution failed (${result.status}): ${result.body}`);
    } else {
      console.log('\n⚠ No SUPABASE_ACCESS_TOKEN set — skipping automated execution');
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  MANUAL EXECUTION REQUIRED');
    console.log('══════════════════════════════════════════════════════');
    console.log(`  1. Open: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
    console.log('  2. Paste the SQL from:');
    console.log('     supabase/migrations/004_enable_rls.sql');
    console.log('  3. Click "Run"');
    console.log('\n  OR: set SUPABASE_ACCESS_TOKEN=<your-pat> and re-run this script');
    console.log('  Get your PAT at: https://supabase.com/dashboard/account/tokens');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

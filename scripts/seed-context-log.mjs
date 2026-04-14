/**
 * seed-context-log.mjs
 * Seed the context_log table with cross-session dispatch memory.
 * Run AFTER creating the table via scripts/create-context-log-table.sql
 *
 * Usage:
 *   node scripts/seed-context-log.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const rows = [
  // ── DECISIONS ──────────────────────────────────────────────────────────────
  {
    source: 'personal_dispatch',
    category: 'decision',
    summary: 'Supabase is primary DB, Salesforce is hot standby',
    details: { note: 'SF should be fully functional fallback, not just backup mirror' },
    status: 'active',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'decision',
    summary: 'Stripe Tap to Pay for in-person events instead of Square',
    details: { reason: 'One payment system, no extra reconciliation' },
    status: 'active',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'decision',
    summary: 'MMMM bracelet selection: 193 heroes, 1000 units from burnout list',
    details: { criteria: 'Lowest lifetime sales, individual only, excluded YWE/Carazo/JSZ' },
    status: 'active',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'decision',
    summary: 'Contact migration: old table renamed contacts_legacy, 14634 new contacts loading',
    status: 'active',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'decision',
    summary: 'DRMF approach: CTO-as-a-service, prove with deliverables, dont overpromise',
    status: 'active',
    related_project: 'drmf',
  },

  // ── RESOLVED ACTIONS ───────────────────────────────────────────────────────
  {
    source: 'personal_dispatch',
    category: 'action',
    summary: 'Tracy Hutter POA signed and sent for IRS CP171 penalty abatement',
    details: { deadline: 'April 30 2026', amount: '$3481.46' },
    status: 'resolved',
    related_project: 'shos',
    related_contacts: ['tracy@hutter-cpa.com'],
  },
  {
    source: 'personal_dispatch',
    category: 'action',
    summary: 'Order status API built at /api/orders/status combining Supabase + ShipStation',
    status: 'resolved',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'action',
    summary: 'SKU reconciliation complete: 21880 units, 369 heroes, 100% match rate',
    details: { rosetta_files: 'Finance/Order Reconciliation/' },
    status: 'resolved',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'action',
    summary: 'Unknown Signal deployed to Vercel at unknown-signal.vercel.app',
    status: 'resolved',
    related_project: 'unknown-signal',
  },
  {
    source: 'steelhearts_dispatch',
    category: 'action',
    summary: 'Chris Merz email sent',
    status: 'resolved',
    related_project: 'shos',
  },

  // ── ACTIVE ACTIONS ─────────────────────────────────────────────────────────
  {
    source: 'personal_dispatch',
    category: 'action',
    summary: 'Squarespace API polling cron built (5 min interval)',
    details: { needs: 'redeploy + system_config table in Supabase' },
    status: 'active',
    related_project: 'shos',
  },
  {
    source: 'steelhearts_dispatch',
    category: 'action',
    summary: 'Contact migration schema created, loader script at Downloads/Contact_Migration_Loader.mjs',
    details: { needs: 'Run loader from local machine' },
    status: 'active',
    related_project: 'shos',
  },

  // ── OPEN ITEMS ─────────────────────────────────────────────────────────────
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Tracy needs expanded Form 2848 POA covering 2021-2023 abatement letters — waiting on Tracy',
    related_project: 'shos',
    related_contacts: ['tracy@hutter-cpa.com'],
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Notion refund $701.44 pending — waiting on Maria (nonprofit rate never applied)',
    related_project: 'shos',
    related_contacts: ['maria@notion.so'],
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Kristin DocuSign governance docs viewed but not signed (was due Apr 3)',
    related_project: 'shos',
    related_contacts: ['kristin.hughes@steel-hearts.org'],
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Kenny Durbin / Fallen Wings / ZEUS 95 follow-up needed',
    related_project: 'shos',
    related_contacts: ['kenny@fallenwingsfoundation.org'],
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'MMMM donation reconciliation needed — match event donations to donor records',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'MMMM photos need consolidation — gather from all sources into shared drive',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'MMMM Gold Star family follow-ups: 6 families need personal outreach post-event',
    details: { count: 6 },
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Contact migration loader needs to run — 14634 contacts staged in Downloads/',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Write lifetime_sold + legacy_skus to Supabase heroes table',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Squarespace poller needs redeploy + system_config table in Supabase',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'DRMF app needs cleanup for Sarah — remove dev scaffolding, polish UI',
    related_project: 'drmf',
    related_contacts: ['sarah@drewross.org'],
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Schedule Sarah/Carly DRMF strategy call (Mondays 10AM or 12:30PM)',
    related_project: 'drmf',
    related_contacts: ['sarah@drewross.org'],
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Rotate Stripe live key — current key has been in codebase too long',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Carlisle property: Canadian officer response due Tuesday, Haith family as backup applicant',
    related_project: 'carlisle',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Family intake QR form needed for future events — paper intake is too slow',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Board memo for Chris Merz situation — evidence gathered, draft not started',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'MMMM hotels need booking (Thu Wytheville, Fri Gatlinburg, Sat return)',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'Stripe Tap to Pay setup for in-person donations',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'open_item',
    summary: 'DRMF proposal/deck for Carly call (Mondays 10AM or 12:30PM)',
    related_project: 'drmf',
    related_contacts: ['sarah@drewross.org'],
  },

  // ── RESOLVED (this build task) ─────────────────────────────────────────────
  {
    source: 'personal_dispatch',
    category: 'action',
    summary: 'Build master feed: /api/context/boot rewritten as unified Dispatch feed',
    details: {
      sources: ['context_log', 'google_calendar', 'squarespace_orders', 'order_pipeline'],
      roles: ['joseph', 'kristin'],
    },
    status: 'resolved',
    related_project: 'shos',
  },

  // ── CONTEXT ────────────────────────────────────────────────────────────────
  {
    source: 'personal_dispatch',
    category: 'context',
    summary: "Joseph's signature saved at C:/dev/.signatures/joseph_wiseman.png",
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'context',
    summary: 'Full Squarespace order history: 17694 rows, 21880 bracelet units, 369 heroes',
    related_project: 'shos',
  },
  {
    source: 'personal_dispatch',
    category: 'context',
    summary: 'DRMF pain points assessed from Sarah conversation transcript',
    details: {
      key_people: 'Carly (Microsoft board member), Heather (marketing), Aunt Kathy (QB), compliance contractor ($34/hr)',
    },
    related_project: 'drmf',
  },
  {
    source: 'personal_dispatch',
    category: 'context',
    summary: 'Ruck and Roll June 6 2026, VA War Memorial to Tredegar Iron Works, Richmond VA',
    related_project: 'drmf',
  },
];

async function seed() {
  console.log(`Seeding ${rows.length} rows into context_log...`);
  const { data, error } = await sb.from('context_log').insert(rows).select('id');
  if (error) {
    console.error('Seed failed:', error.message);
    if (error.code === '42P01') {
      console.error('\nTable does not exist. Run scripts/create-context-log-table.sql in the Supabase SQL editor first:');
      console.error('https://supabase.com/dashboard/project/esoogmdwzcarvlodwbue/sql');
    }
    process.exit(1);
  }
  console.log(`Done. Inserted ${data.length} rows.`);
}

seed();

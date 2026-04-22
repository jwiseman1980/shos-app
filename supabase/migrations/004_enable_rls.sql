-- ============================================================
-- RLS Security Migration — Supabase Project A (HonorBase)
-- Generated: 2026-04-22T14:31:01.705Z
-- Enables Row Level Security on ALL public tables.
-- Service role has full access to every table.
-- heroes + family_messages allow anonymous SELECT for the website.
-- gyst_plaid_items (contains Plaid access tokens) is strict service_role only.
-- ============================================================

-- ── Step 1: Enable RLS on all existing tables ─────────────────
ALTER TABLE public.anniversary_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_property_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyst_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_dashboard_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hb_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorbase_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_knowledge_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_knowledge_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sf_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media_profile_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;

-- ── Step 2: Drop ALL existing policies (idempotent + fixes overly permissive ones) ─
-- The original schema created "Allow all for authenticated" (USING TRUE) on all
-- tables — that exposes everything to the anon key. Drop it here.
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.anniversary_emails;
DROP POLICY IF EXISTS "service_role_all" ON public.anniversary_emails;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.chat_messages;
DROP POLICY IF EXISTS "service_role_all" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.chat_sessions;
DROP POLICY IF EXISTS "service_role_all" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.closeouts;
DROP POLICY IF EXISTS "service_role_all" ON public.closeouts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.contacts;
DROP POLICY IF EXISTS "service_role_all" ON public.contacts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.context_log;
DROP POLICY IF EXISTS "service_role_all" ON public.context_log;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.decisions;
DROP POLICY IF EXISTS "service_role_all" ON public.decisions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.disbursements;
DROP POLICY IF EXISTS "service_role_all" ON public.disbursements;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.donations;
DROP POLICY IF EXISTS "service_role_all" ON public.donations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.engagements;
DROP POLICY IF EXISTS "service_role_all" ON public.engagements;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.execution_log;
DROP POLICY IF EXISTS "service_role_all" ON public.execution_log;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.expenses;
DROP POLICY IF EXISTS "service_role_all" ON public.expenses;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.family_messages;
DROP POLICY IF EXISTS "service_role_all" ON public.family_messages;
DROP POLICY IF EXISTS "anon_read" ON public.family_messages;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.friction_logs;
DROP POLICY IF EXISTS "service_role_all" ON public.friction_logs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_accounts;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_accounts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_action_items;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_action_items;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_budget_categories;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_budget_categories;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_debts;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_debts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_income_sources;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_income_sources;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_monthly_snapshots;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_monthly_snapshots;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_plaid_items;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_plaid_items;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_properties;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_properties;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_property_costs;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_property_costs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.gyst_transactions;
DROP POLICY IF EXISTS "service_role_all" ON public.gyst_transactions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.hb_dashboard_cards;
DROP POLICY IF EXISTS "service_role_all" ON public.hb_dashboard_cards;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.hb_messages;
DROP POLICY IF EXISTS "service_role_all" ON public.hb_messages;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.hero_associations;
DROP POLICY IF EXISTS "service_role_all" ON public.hero_associations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.heroes;
DROP POLICY IF EXISTS "service_role_all" ON public.heroes;
DROP POLICY IF EXISTS "anon_read" ON public.heroes;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.honorbase_orgs;
DROP POLICY IF EXISTS "service_role_all" ON public.honorbase_orgs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.initiatives;
DROP POLICY IF EXISTS "service_role_all" ON public.initiatives;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.knowledge_files;
DROP POLICY IF EXISTS "service_role_all" ON public.knowledge_files;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.open_questions;
DROP POLICY IF EXISTS "service_role_all" ON public.open_questions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.order_items;
DROP POLICY IF EXISTS "service_role_all" ON public.order_items;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.orders;
DROP POLICY IF EXISTS "service_role_all" ON public.orders;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.org_knowledge_artifacts;
DROP POLICY IF EXISTS "service_role_all" ON public.org_knowledge_artifacts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.org_members;
DROP POLICY IF EXISTS "service_role_all" ON public.org_members;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.org_stream;
DROP POLICY IF EXISTS "service_role_all" ON public.org_stream;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.organizations;
DROP POLICY IF EXISTS "service_role_all" ON public.organizations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.platform_knowledge_pool;
DROP POLICY IF EXISTS "service_role_all" ON public.platform_knowledge_pool;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.sf_sync_log;
DROP POLICY IF EXISTS "service_role_all" ON public.sf_sync_log;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.social_media_posts;
DROP POLICY IF EXISTS "service_role_all" ON public.social_media_posts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.social_media_profile_snapshots;
DROP POLICY IF EXISTS "service_role_all" ON public.social_media_profile_snapshots;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.sop_executions;
DROP POLICY IF EXISTS "service_role_all" ON public.sop_executions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.system_config;
DROP POLICY IF EXISTS "service_role_all" ON public.system_config;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.tasks;
DROP POLICY IF EXISTS "service_role_all" ON public.tasks;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.users;
DROP POLICY IF EXISTS "service_role_all" ON public.users;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.volunteers;
DROP POLICY IF EXISTS "service_role_all" ON public.volunteers;

-- ── Step 3: Service-role full-access policy for ALL tables ──────
-- The app always uses the service_role key server-side, so this
-- policy ensures no server operation is accidentally blocked.
CREATE POLICY "service_role_all" ON public.anniversary_emails
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.chat_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.chat_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.closeouts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.contacts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.context_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.decisions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.disbursements
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.donations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.engagements
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.execution_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.expenses
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.family_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.friction_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_accounts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_action_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_budget_categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_debts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_income_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_monthly_snapshots
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_plaid_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_properties
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_property_costs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.gyst_transactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.hb_dashboard_cards
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.hb_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.hero_associations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.heroes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.honorbase_orgs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.initiatives
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.knowledge_files
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.open_questions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.order_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.org_knowledge_artifacts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.org_members
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.org_stream
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.organizations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.platform_knowledge_pool
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.sf_sync_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.social_media_posts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.social_media_profile_snapshots
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.sop_executions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.system_config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.tasks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON public.volunteers
  FOR ALL USING (auth.role() = 'service_role');

-- ── Step 4: Public read for website-facing tables ────────────────
CREATE POLICY "anon_read" ON public.heroes
  FOR SELECT USING (true);

CREATE POLICY "anon_read" ON public.family_messages
  FOR SELECT USING (true);

-- ── Step 5: Verify ───────────────────────────────────────────────
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

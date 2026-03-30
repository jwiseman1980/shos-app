-- =============================================================================
-- STEEL HEARTS SUPABASE SCHEMA v1.0
-- Designed: 2026-03-28
--
-- This schema replaces Salesforce as the primary database for the SHOS App.
-- SF becomes a nightly backup mirror. Notion databases are absorbed here.
--
-- Naming conventions:
--   - snake_case everything (no __c suffixes)
--   - UUID primary keys (Supabase default, sync-friendly)
--   - created_at / updated_at on every table
--   - Foreign keys with ON DELETE SET NULL (preserve history)
--   - Indexes on frequently queried columns
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE branch AS ENUM (
  'Army', 'Navy', 'Air Force', 'Marines', 'Coast Guard', 'Space Force',
  'National Guard', 'Reserves', 'USMA', 'USNA', 'USAFA', 'USCGA', 'USMMA',
  'Other'
);

CREATE TYPE order_type AS ENUM (
  'paid', 'donated', 'wholesale', 'gift', 'replacement'
);

CREATE TYPE production_status AS ENUM (
  'not_started', 'design_needed', 'ready_to_laser', 'in_production',
  'ready_to_ship', 'shipped', 'delivered', 'cancelled'
);

CREATE TYPE design_status AS ENUM (
  'not_started', 'research', 'in_progress', 'review', 'approved', 'complete'
);

CREATE TYPE message_status AS ENUM (
  'new', 'ready_to_send', 'sent', 'held', 'spam'
);

CREATE TYPE donation_source AS ENUM (
  'donorbox', 'stripe', 'squarespace', 'check', 'cash', 'event',
  'paypal', 'venmo', 'zelle', 'other'
);

CREATE TYPE payment_method AS ENUM (
  'credit_card', 'ach', 'check', 'wire', 'paypal', 'venmo', 'zelle', 'cash', 'other'
);

CREATE TYPE task_status AS ENUM (
  'backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled'
);

CREATE TYPE task_priority AS ENUM (
  'critical', 'high', 'medium', 'low'
);

CREATE TYPE volunteer_status AS ENUM (
  'prospect', 'onboarding', 'active', 'inactive', 'alumni'
);

CREATE TYPE anniversary_status AS ENUM (
  'not_started', 'prep', 'assigned', 'email_drafted', 'email_sent',
  'social_posted', 'complete', 'skipped'
);

CREATE TYPE engagement_type AS ENUM (
  'social_media', 'email', 'phone', 'in_person', 'event', 'partnership', 'other'
);

CREATE TYPE friction_priority AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE friction_status AS ENUM (
  'open', 'triaged', 'queued', 'in_progress', 'done', 'wont_fix'
);

CREATE TYPE shos_role AS ENUM (
  'ed', 'cos', 'cfo', 'coo', 'comms', 'dev', 'family'
);

CREATE TYPE disbursement_fund_type AS ENUM (
  'restricted', 'unrestricted', 'steel_hearts_fund'
);

CREATE TYPE expense_category AS ENUM (
  'materials', 'shipping', 'software', 'professional_services',
  'office_supplies', 'travel', 'marketing', 'insurance',
  'compensation', 'bank_fees', 'donations_out', 'other'
);

-- =============================================================================
-- CORE TABLES: USERS & AUTH
-- =============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role shos_role,
  color TEXT DEFAULT '#3498db',
  initials TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CORE MISSION DATA
-- =============================================================================

-- Organizations / Partner Charities (was: Account in SF)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,                          -- Salesforce Account ID for sync
  name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  billing_street TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postal TEXT,
  billing_country TEXT,
  -- Financial tracking
  total_obligations NUMERIC(12,2) DEFAULT 0,  -- Total accrued from bracelet sales
  total_disbursed NUMERIC(12,2) DEFAULT 0,    -- Total paid out
  outstanding_balance NUMERIC(12,2) DEFAULT 0,-- Obligations minus disbursed
  disbursed_2026 NUMERIC(12,2) DEFAULT 0,     -- Year-specific tracking
  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_organizations_sf_id ON organizations(sf_id);

-- Contacts / Family Members (was: Contact in SF)
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,                          -- Salesforce Contact ID for sync
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mailing_street TEXT,
  mailing_city TEXT,
  mailing_state TEXT,
  mailing_postal TEXT,
  mailing_country TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_last_name ON contacts(last_name);
CREATE INDEX idx_contacts_sf_id ON contacts(sf_id);

-- Heroes / Memorial Bracelets (was: Memorial_Bracelet__c in SF)
CREATE TABLE heroes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,                          -- Salesforce Memorial_Bracelet__c ID
  -- Identity
  name TEXT NOT NULL,                         -- Display name (e.g., "CPT Brandon Stevenson")
  first_name TEXT,
  middle_name_initial TEXT,
  last_name TEXT NOT NULL,
  rank TEXT,
  branch branch,
  -- Memorial
  memorial_date DATE,
  memorial_month INTEGER,                     -- 1-12
  memorial_day INTEGER,                       -- 1-31
  incident TEXT,
  -- Status
  active_listing BOOLEAN DEFAULT FALSE,       -- CRITICAL: only true = visible on website
  bracelet_sent BOOLEAN DEFAULT FALSE,
  -- Inventory
  on_hand_7in INTEGER DEFAULT 0,
  on_hand_6in INTEGER DEFAULT 0,
  total_on_hand INTEGER GENERATED ALWAYS AS (on_hand_7in + on_hand_6in) STORED,
  -- Financial
  total_donations_raised NUMERIC(12,2) DEFAULT 0,
  funds_donated NUMERIC(12,2) DEFAULT 0,
  -- Design
  lineitem_sku TEXT,                          -- e.g., ARMY-STEVENSON
  design_status design_status DEFAULT 'not_started',
  design_priority INTEGER,
  design_brief TEXT,
  has_graphic_design BOOLEAN DEFAULT FALSE,
  bracelet_design_created BOOLEAN DEFAULT FALSE,
  -- Anniversary
  anniversary_status anniversary_status DEFAULT 'not_started',
  anniversary_outreach_status TEXT,
  anniversary_assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  anniversary_completed_date DATE,
  anniversary_notes TEXT,
  -- Relationships
  family_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  -- Website
  bio_page_url TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heroes_active ON heroes(active_listing) WHERE active_listing = TRUE;
CREATE INDEX idx_heroes_last_name ON heroes(last_name);
CREATE INDEX idx_heroes_sku ON heroes(lineitem_sku);
CREATE INDEX idx_heroes_memorial_month ON heroes(memorial_month);
CREATE INDEX idx_heroes_branch ON heroes(branch);
CREATE INDEX idx_heroes_sf_id ON heroes(sf_id);
CREATE INDEX idx_heroes_anniversary_status ON heroes(anniversary_status);
CREATE INDEX idx_heroes_design_status ON heroes(design_status);

-- Hero Associations / Junction Table (was: Hero_Association__c in SF)
CREATE TABLE hero_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT,                                  -- 'Surviving Family', 'Organization', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hero_id, contact_id, role)
);

CREATE INDEX idx_hero_associations_hero ON hero_associations(hero_id);
CREATE INDEX idx_hero_associations_contact ON hero_associations(contact_id);

-- =============================================================================
-- ORDERS & PRODUCTION
-- =============================================================================

-- Orders (was: Squarespace_Order__c in SF)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  order_number TEXT,                          -- Squarespace order number
  order_type order_type DEFAULT 'paid',
  order_date DATE,
  -- Billing
  billing_name TEXT,
  billing_email TEXT,
  -- Shipping
  shipping_name TEXT,
  shipping_address1 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_postal TEXT,
  shipping_country TEXT,
  -- Metadata
  source TEXT DEFAULT 'squarespace',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_billing_email ON orders(billing_email);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_sf_id ON orders(sf_id);

-- Order Items / Line Items (was: Squarespace_Order_Item__c in SF)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL,
  -- Product
  lineitem_sku TEXT,                          -- e.g., ARMY-STEVENSON-7, ARMY-STEVENSON-7D
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2),                   -- $35 standard, $45 D-variant, $0 donated
  bracelet_size TEXT,                         -- '7' or '6'
  -- Production
  production_status production_status DEFAULT 'not_started',
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_hero ON order_items(hero_id);
CREATE INDEX idx_order_items_sku ON order_items(lineitem_sku);
CREATE INDEX idx_order_items_production ON order_items(production_status);
CREATE INDEX idx_order_items_sf_id ON order_items(sf_id);

-- =============================================================================
-- FINANCIAL
-- =============================================================================

-- Donations Received (was: Donation__c in SF)
CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  -- Donor info
  donor_first_name TEXT,
  donor_last_name TEXT,
  donor_email TEXT,
  billing_name TEXT,
  donor_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Transaction
  amount NUMERIC(10,2) NOT NULL,
  donation_date DATE,
  paid_at TIMESTAMPTZ,
  source donation_source,
  origin TEXT,
  payment_method payment_method,
  order_id TEXT,                              -- External order reference
  amount_refunded NUMERIC(10,2) DEFAULT 0,
  -- Stewardship
  thank_you_sent BOOLEAN DEFAULT FALSE,
  thank_you_date DATE,
  thank_you_by UUID REFERENCES users(id) ON DELETE SET NULL,
  donor_segment TEXT,                         -- first-time, repeat, major, lapsed, etc.
  campaign TEXT,
  impact_update_sent BOOLEAN DEFAULT FALSE,
  impact_update_date DATE,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_donations_donor_email ON donations(donor_email);
CREATE INDEX idx_donations_date ON donations(donation_date);
CREATE INDEX idx_donations_source ON donations(source);
CREATE INDEX idx_donations_sf_id ON donations(sf_id);

-- Disbursements to Charities (was: Donation_Disbursement__c in SF)
CREATE TABLE disbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL,
  disbursement_date DATE,
  fund_type disbursement_fund_type,
  cycle_month INTEGER,                        -- 1-12
  cycle_year INTEGER,
  payment_method payment_method,
  confirmation_number TEXT,
  gmail_message_id TEXT,                      -- Reference to payment email
  receipt_captured BOOLEAN DEFAULT FALSE,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disbursements_org ON disbursements(organization_id);
CREATE INDEX idx_disbursements_date ON disbursements(disbursement_date);
CREATE INDEX idx_disbursements_cycle ON disbursements(cycle_year, cycle_month);
CREATE INDEX idx_disbursements_sf_id ON disbursements(sf_id);

-- Expenses (was: Expense__c in SF)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  transaction_date DATE NOT NULL,
  description TEXT,
  category expense_category,
  amount NUMERIC(10,2) NOT NULL,
  bank_account TEXT,                          -- 'Checking-2352', 'CC-3418'
  vendor TEXT,
  month INTEGER,                              -- 1-12
  year INTEGER,
  is_excluded BOOLEAN DEFAULT FALSE,          -- Exclude from calculations
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(transaction_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_year_month ON expenses(year, month);
CREATE INDEX idx_expenses_sf_id ON expenses(sf_id);

-- =============================================================================
-- FAMILY RELATIONS
-- =============================================================================

-- Family Messages / Supporter Condolences (was: Family_Message__c in SF)
CREATE TABLE family_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL,
  -- Message
  message TEXT,
  from_name TEXT,
  from_email TEXT,
  -- Source
  source TEXT,                                -- 'Squarespace Purchase', 'Bio Page Form', etc.
  item_description TEXT,
  order_ref TEXT,
  sku TEXT,
  submitted_date DATE,
  -- Status
  status message_status DEFAULT 'new',
  consent_to_share BOOLEAN DEFAULT FALSE,
  wants_memorial_updates BOOLEAN DEFAULT FALSE,
  -- Dedup
  dedup_hash TEXT UNIQUE,                     -- SHA256 for duplicate detection
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_family_messages_hero ON family_messages(hero_id);
CREATE INDEX idx_family_messages_status ON family_messages(status);
CREATE INDEX idx_family_messages_sf_id ON family_messages(sf_id);

-- =============================================================================
-- NEW: TASK MANAGEMENT (replaces Notion Steel Hearts Tasks)
-- =============================================================================

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  -- Assignment
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Categorization
  role shos_role,                             -- Which operational role this belongs to
  domain TEXT,                                -- 'finance', 'operations', 'comms', etc.
  sop_ref TEXT,                               -- Reference to SOP if task is SOP-driven
  -- Relationships
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  -- Dates
  due_date DATE,
  completed_at TIMESTAMPTZ,
  -- Cadence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,                       -- 'daily', 'weekly', 'monthly', cron, etc.
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- For subtasks
  -- Metadata
  tags TEXT[],                                -- Flexible tagging
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_role ON tasks(role);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_hero ON tasks(hero_id);

-- =============================================================================
-- NEW: VOLUNTEER MANAGEMENT (replaces Notion Volunteer Onboarding Tracker)
-- =============================================================================

CREATE TABLE volunteers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  -- Status
  status volunteer_status DEFAULT 'prospect',
  -- Onboarding
  onboarded_date DATE,
  onboarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  slack_joined BOOLEAN DEFAULT FALSE,
  google_workspace_setup BOOLEAN DEFAULT FALSE,
  training_complete BOOLEAN DEFAULT FALSE,
  -- Capabilities
  can_do_anniversaries BOOLEAN DEFAULT FALSE,
  can_do_social_media BOOLEAN DEFAULT FALSE,
  can_do_design BOOLEAN DEFAULT FALSE,
  can_do_shipping BOOLEAN DEFAULT FALSE,
  -- Assignment
  team_lead UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Relationship
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Link to app user if they have login
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_volunteers_status ON volunteers(status);
CREATE INDEX idx_volunteers_email ON volunteers(email);

-- =============================================================================
-- NEW: ENGAGEMENT & DECISION LOGS (replaces Notion trackers)
-- =============================================================================

CREATE TABLE engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- What happened
  type engagement_type NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  -- Who
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL,
  logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- When
  engagement_date DATE DEFAULT CURRENT_DATE,
  -- Metadata
  outcome TEXT,
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_engagements_type ON engagements(type);
CREATE INDEX idx_engagements_date ON engagements(engagement_date);
CREATE INDEX idx_engagements_org ON engagements(organization_id);
CREATE INDEX idx_engagements_contact ON engagements(contact_id);

CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_date DATE DEFAULT CURRENT_DATE,
  domain TEXT,                                -- 'architecture', 'finance', 'operations', etc.
  role shos_role,
  -- Reference
  related_sop TEXT,
  related_engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
  -- Metadata
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_domain ON decisions(domain);
CREATE INDEX idx_decisions_date ON decisions(decided_date);

CREATE TABLE open_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  context TEXT,
  raised_by UUID REFERENCES users(id) ON DELETE SET NULL,
  raised_date DATE DEFAULT CURRENT_DATE,
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolution TEXT,
  resolved_date DATE,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decision_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
  -- Categorization
  domain TEXT,
  role shos_role,
  priority task_priority DEFAULT 'medium',
  -- Metadata
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_open_questions_resolved ON open_questions(resolved);
CREATE INDEX idx_open_questions_domain ON open_questions(domain);

-- =============================================================================
-- NEW: ANNIVERSARY EMAIL DRAFTS (replaces Notion draft pages)
-- =============================================================================

CREATE TABLE anniversary_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hero_id UUID NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  -- Email content
  subject TEXT,
  body TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  -- Status
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT DEFAULT 'draft',                -- 'draft', 'assigned', 'sent', 'skipped'
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_date DATE,
  gmail_message_id TEXT,
  -- Metadata
  template_version TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anniversary_emails_hero ON anniversary_emails(hero_id);
CREATE INDEX idx_anniversary_emails_year_month ON anniversary_emails(year, month);
CREATE INDEX idx_anniversary_emails_status ON anniversary_emails(status);
CREATE INDEX idx_anniversary_emails_assigned ON anniversary_emails(assigned_to);

-- =============================================================================
-- SYSTEM / OPERATIONAL
-- =============================================================================

-- Knowledge Files (was: SHOS_Knowledge__c in SF)
CREATE TABLE knowledge_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  name TEXT NOT NULL,
  role shos_role NOT NULL,
  content TEXT,                               -- Markdown content
  session_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role)
);

-- Friction Logs (was: SHOS_Friction__c in SF)
CREATE TABLE friction_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sf_id TEXT UNIQUE,
  role shos_role,
  type TEXT,
  priority friction_priority DEFAULT 'medium',
  description TEXT NOT NULL,
  status friction_status DEFAULT 'open',
  logged_date DATE DEFAULT CURRENT_DATE,
  logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_date DATE,
  resolution TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_friction_logs_status ON friction_logs(status);
CREATE INDEX idx_friction_logs_role ON friction_logs(role);
CREATE INDEX idx_friction_logs_priority ON friction_logs(priority);

-- SOP Execution Log (replaces Notion SOP Execution Log)
CREATE TABLE sop_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sop_id TEXT NOT NULL,                       -- SOP reference (e.g., 'SOP-FIN-001')
  sop_name TEXT,
  executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  execution_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',            -- 'completed', 'partial', 'failed'
  duration_minutes INTEGER,
  notes TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sop_executions_sop ON sop_executions(sop_id);
CREATE INDEX idx_sop_executions_date ON sop_executions(execution_date);

-- Session Closeout Queue (replaces Notion SHOS Closeout Queue)
CREATE TABLE closeouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_date DATE DEFAULT CURRENT_DATE,
  role shos_role,
  summary TEXT,
  decisions_made TEXT[],
  artifacts_created TEXT[],
  follow_ups TEXT[],
  status TEXT DEFAULT 'pending',              -- 'pending', 'processed', 'archived'
  processed_date DATE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_closeouts_status ON closeouts(status);
CREATE INDEX idx_closeouts_role ON closeouts(role);

-- Founder Impact Tracker (replaces Notion database)
CREATE TABLE initiatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,                                -- 'operations', 'finance', 'partnerships', etc.
  status TEXT DEFAULT 'active',               -- 'active', 'paused', 'completed', 'abandoned'
  started_date DATE,
  target_date DATE,
  completed_date DATE,
  impact_score INTEGER,                       -- 1-10 subjective rating
  notes TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SALESFORCE SYNC TRACKING
-- =============================================================================

CREATE TABLE sf_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  direction TEXT NOT NULL,                    -- 'supabase_to_sf', 'sf_to_supabase'
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',              -- 'running', 'completed', 'failed'
  error_message TEXT,
  details JSONB                               -- Flexible field for sync metadata
);

CREATE INDEX idx_sf_sync_log_table ON sf_sync_log(table_name);
CREATE INDEX idx_sf_sync_log_status ON sf_sync_log(status);

-- =============================================================================
-- SOCIAL MEDIA TRACKING
-- =============================================================================

CREATE TABLE social_media_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,                       -- 'facebook', 'instagram'
  platform_post_id TEXT NOT NULL UNIQUE,        -- Meta Graph API post ID
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL,
  caption TEXT,
  permalink TEXT,
  media_type TEXT,                              -- 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'status'
  thumbnail_url TEXT,
  posted_at TIMESTAMPTZ,
  is_anniversary_post BOOLEAN DEFAULT FALSE,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_posts_platform ON social_media_posts(platform);
CREATE INDEX idx_social_posts_posted ON social_media_posts(posted_at DESC);
CREATE INDEX idx_social_posts_hero ON social_media_posts(hero_id);

CREATE TABLE social_media_profile_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,                       -- 'instagram', 'facebook'
  username TEXT,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, snapshot_date)
);

CREATE INDEX idx_social_profiles_date ON social_media_profile_snapshots(snapshot_date DESC);

-- =============================================================================
-- AUTO-UPDATE TIMESTAMPS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (prep for team access)
-- =============================================================================

-- Enable RLS on all tables (policies to be added when auth is configured)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE heroes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE anniversary_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE friction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_sync_log ENABLE ROW LEVEL SECURITY;

-- For now: allow all authenticated users full access (tighten later)
-- These policies will be replaced with role-based policies when team auth is built
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'CREATE POLICY "Allow all for authenticated" ON %I FOR ALL USING (TRUE) WITH CHECK (TRUE)',
      t
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- SCHEMA SUMMARY
-- =============================================================================
--
-- TABLES: 22
--
-- Core Mission (migrated from SF):
--   organizations, contacts, heroes, hero_associations,
--   orders, order_items, donations, disbursements, expenses,
--   family_messages
--
-- New Operational (replacing Notion):
--   tasks, volunteers, engagements, decisions, open_questions,
--   anniversary_emails, initiatives
--
-- System:
--   users, knowledge_files, friction_logs, sop_executions,
--   closeouts, sf_sync_log
--
-- SF SYNC:
--   Every table from SF has an sf_id column for bidirectional mapping.
--   sf_sync_log tracks sync runs.
--   Sync direction: Supabase → Salesforce (nightly).
--
-- =============================================================================

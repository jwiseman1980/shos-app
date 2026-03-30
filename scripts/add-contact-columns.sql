-- Add missing columns to contacts table for Notion Accounts & Contacts migration
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/esoogmdwzcarvlodwbue/sql

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS relationship text[] DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS record_type text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS donor_stewardship_status text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_tier text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS suppression_status text[] DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS suppressed boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS family_anniversary_eligible boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS family_message_eligible boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS purchaser_anniversary_eligible boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS newsletter_eligible boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS newsletter_subscribed boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS org_status text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_action_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS event_research_status text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hero_gap_count integer DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sf_account_id text;

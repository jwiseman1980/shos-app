-- Events Management Tables
-- Run this in Supabase SQL editor to create the events feature schema

-- events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_date DATE,
  location TEXT,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'complete', 'cancelled')),
  registration_count INT DEFAULT 0,
  revenue_actual NUMERIC(10,2) DEFAULT 0,
  revenue_expected NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- event_tasks table (checklist items per event)
CREATE TABLE IF NOT EXISTS event_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- event_sponsors table
CREATE TABLE IF NOT EXISTS event_sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  amount_pledged NUMERIC(10,2) DEFAULT 0,
  amount_received NUMERIC(10,2) DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('platinum', 'gold', 'silver', 'bronze', 'in-kind')),
  status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect', 'confirmed', 'paid', 'declined')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- event_budget_items table
CREATE TABLE IF NOT EXISTS event_budget_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'expense',
  amount_budgeted NUMERIC(10,2) DEFAULT 0,
  amount_actual NUMERIC(10,2) DEFAULT 0,
  vendor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON event_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sponsors_event_id ON event_sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_event_budget_items_event_id ON event_budget_items(event_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

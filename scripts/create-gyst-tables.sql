-- GYST Property Management Tables
-- Run via Supabase SQL Editor or psql

CREATE TABLE IF NOT EXISTS gyst_properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  purchase_price NUMERIC(12,2),
  purchase_date DATE,
  current_value NUMERIC(12,2),
  mortgage_rate NUMERIC(5,4),
  lot_sqft INTEGER,
  beds INTEGER,
  baths NUMERIC(3,1),
  sqft INTEGER,
  lease_rate NUMERIC(10,2),
  lease_term_months INTEGER,
  lease_start DATE,
  lease_end DATE,
  tenant_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'vacant', 'turnover', 'listed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gyst_property_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES gyst_properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('renovation', 'furnishing', 'landscaping', 'maintenance', 'utilities')),
  item TEXT NOT NULL,
  low_estimate NUMERIC(10,2),
  high_estimate NUMERIC(10,2),
  actual_cost NUMERIC(10,2),
  timing TEXT,
  financing_method TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'purchased', 'completed')),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_period TEXT CHECK (recurring_period IN ('monthly', 'annual', NULL)),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gyst_costs_property ON gyst_property_costs(property_id);
CREATE INDEX IF NOT EXISTS idx_gyst_costs_category ON gyst_property_costs(category);

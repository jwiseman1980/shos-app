-- Add lifetime_sold and legacy_skus to heroes table
-- Run once in Supabase SQL Editor before executing write-lifetime-sales.mjs

ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS lifetime_sold  INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legacy_skus    TEXT[]   DEFAULT '{}';

-- Index for future reporting/leaderboards
CREATE INDEX IF NOT EXISTS idx_heroes_lifetime_sold ON heroes(lifetime_sold DESC);

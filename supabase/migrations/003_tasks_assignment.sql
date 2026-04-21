-- Migration: add source tracking to tasks table
-- Apply via Supabase dashboard SQL editor or `supabase db push`

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_type TEXT,  -- 'email', 'order', 'hero', 'anniversary', 'manual'
  ADD COLUMN IF NOT EXISTS source_id   TEXT;  -- thread_id, order_id, hero_id, etc.

CREATE INDEX IF NOT EXISTS idx_tasks_source_type ON tasks(source_type) WHERE source_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_source_id   ON tasks(source_id)   WHERE source_id   IS NOT NULL;

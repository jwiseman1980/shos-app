-- Context Log: persistent cross-session dispatch memory
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/esoogmdwzcarvlodwbue/sql

CREATE TABLE IF NOT EXISTS context_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  source text NOT NULL,
  category text NOT NULL,       -- decision | action | open_item | context
  org_id text DEFAULT 'steel-hearts',
  summary text NOT NULL,
  details jsonb,
  status text DEFAULT 'active', -- active | resolved
  related_project text,
  related_contacts text[],
  resolved_at timestamptz,
  resolved_by text
);

CREATE INDEX IF NOT EXISTS idx_context_log_status ON context_log(status);
CREATE INDEX IF NOT EXISTS idx_context_log_category ON context_log(category);
CREATE INDEX IF NOT EXISTS idx_context_log_project ON context_log(related_project);
CREATE INDEX IF NOT EXISTS idx_context_log_created ON context_log(created_at DESC);

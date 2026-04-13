-- Statement Pipeline: Create statements table + storage bucket
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/esoogmdwzcarvlodwbue/sql)

CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  owner TEXT DEFAULT 'steel_hearts',
  statement_month INTEGER NOT NULL,
  statement_year INTEGER NOT NULL,
  closing_date DATE,
  new_balance NUMERIC(10,2),
  pdf_storage_path TEXT,
  pdf_drive_url TEXT,
  csv_processed BOOLEAN DEFAULT FALSE,
  email_message_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statements_account ON statements(account_name);
CREATE INDEX IF NOT EXISTS idx_statements_year_month ON statements(statement_year, statement_month);

-- Storage bucket (run separately in Storage settings or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('statements', 'statements', false);

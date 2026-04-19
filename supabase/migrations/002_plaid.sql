-- Plaid integration tables
-- gyst_accounts: connected bank accounts with live balances
CREATE TABLE IF NOT EXISTS gyst_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_account_id text UNIQUE NOT NULL,
  plaid_item_id text NOT NULL,
  name text NOT NULL,
  type text,
  subtype text,
  institution text,
  current_balance numeric(12,2),
  available_balance numeric(12,2),
  currency text DEFAULT 'USD',
  mask text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- gyst_plaid_items: one row per connected institution (holds access token)
CREATE TABLE IF NOT EXISTS gyst_plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text UNIQUE NOT NULL,
  access_token text NOT NULL,
  institution_id text,
  institution_name text,
  cursor text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add plaid_transaction_id to gyst_transactions if not present
ALTER TABLE gyst_transactions
  ADD COLUMN IF NOT EXISTS plaid_transaction_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS pending boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_id text;

CREATE INDEX IF NOT EXISTS idx_gyst_accounts_item ON gyst_accounts(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_gyst_transactions_plaid ON gyst_transactions(plaid_transaction_id);

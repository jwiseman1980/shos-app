-- Migration: add source_email_thread_id to orders
-- Apply via: Supabase dashboard SQL editor, or `supabase db push`

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source_email_thread_id text;

-- Index for fast lookup of orders by Gmail thread
CREATE INDEX IF NOT EXISTS idx_orders_source_email_thread_id
  ON orders (source_email_thread_id)
  WHERE source_email_thread_id IS NOT NULL;

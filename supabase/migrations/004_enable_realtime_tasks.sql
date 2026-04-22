-- Migration 004: Enable Supabase realtime on the tasks table
-- Apply via Supabase dashboard SQL editor

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

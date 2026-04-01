-- Add slack_user_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- Populate Slack user IDs for all team members
-- Source: Slack workspace TRQKBJGLR, queried 2026-04-01
UPDATE users SET slack_user_id = 'URN3M956W' WHERE email ILIKE 'joseph.wiseman@steel-hearts.org';
UPDATE users SET slack_user_id = 'URQKDPH6D' WHERE email ILIKE 'chris.marti@steel-hearts.org';
UPDATE users SET slack_user_id = 'U05L8Q3RR0W' WHERE email ILIKE 'crysta.gonzalez@steel-hearts.org';
UPDATE users SET slack_user_id = 'U0AMW4VSX9P' WHERE email ILIKE 'ryan.santana@steel-hearts.org';
UPDATE users SET slack_user_id = 'U0AKN73V6FK' WHERE email ILIKE 'kristin.hughes@steel-hearts.org';
UPDATE users SET slack_user_id = 'U0AJTRSFLHM' WHERE email ILIKE 'bianca.baldwin@steel-hearts.org';
UPDATE users SET slack_user_id = 'U0AK99LKUFL' WHERE email ILIKE 'alex.kim@steel-hearts.org';
UPDATE users SET slack_user_id = 'U0AJTRRT46T' WHERE email ILIKE 'sean.reeves@steel-hearts.org';
UPDATE users SET slack_user_id = 'U0AK5SFB7HT' WHERE email ILIKE 'melanie.gness@steel-hearts.org';
UPDATE users SET slack_user_id = 'U02J3NC5VL6' WHERE email ILIKE 'matthew.schwartz@steel-hearts.org';

-- Create index for lookup
CREATE INDEX IF NOT EXISTS idx_users_slack_user_id ON users(slack_user_id);

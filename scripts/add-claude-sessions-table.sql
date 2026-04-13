-- =============================================================================
-- CLAUDE SESSIONS TABLE — Session Index for the Learning Engine
-- Created: 2026-04-01
-- Purpose: Queryable record of every Claude interaction across all interfaces.
--          This is the spine of the SHOS learning system.
-- =============================================================================

-- Session source enum
CREATE TYPE session_source AS ENUM (
  'chat',           -- claude.ai Chat (SHOS Operator, GYST Operator)
  'code',           -- Claude Code / Cowork
  'scheduled',      -- Scheduled tasks (cron, triggers)
  'app'             -- In-app role chat (SHOS app)
);

-- Session outcome enum
CREATE TYPE session_outcome AS ENUM (
  'completed',      -- All planned work accomplished
  'partial',        -- Some items completed, some deferred
  'blocked',        -- Hit a blocker, couldn't proceed
  'exploratory',    -- Research/discussion, no deliverables expected
  'interrupted'     -- Session cut short
);

CREATE TABLE claude_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- When
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  -- Where
  source session_source NOT NULL,
  interface_detail TEXT,              -- e.g., 'SHOS Operator', 'Claude Code opus', 'shos-order-triage'

  -- What
  domain TEXT,                        -- 'architecture', 'finance', 'operations', 'comms', 'family', etc.
  role shos_role,                     -- Which SHOS role was active
  summary TEXT NOT NULL,              -- 1-3 sentence summary of what happened
  topics TEXT[],                      -- Array of topics covered

  -- Artifacts
  decisions_made JSONB DEFAULT '[]',  -- [{title, decision, reasoning}]
  artifacts_produced TEXT[],          -- Commit hashes, doc links, calendar event IDs, files created
  follow_up_items JSONB DEFAULT '[]', -- [{description, calendar_event_id, target_date}]

  -- Evaluation
  outcome session_outcome DEFAULT 'completed',
  intent TEXT,                        -- What we set out to do
  friction_notes TEXT,                -- What was harder than expected
  pattern_flags TEXT[],               -- Repeated patterns detected (potential SOPs)
  efficiency_rating INTEGER,          -- 1-5 scale: 1=mostly friction, 5=smooth execution
  learning_notes TEXT,                -- What the system learned from this session

  -- Linking
  calendar_event_id TEXT,             -- Google Calendar event ID
  calendar_name TEXT,                 -- Which calendar it's on
  parent_session_id UUID REFERENCES claude_sessions(id) ON DELETE SET NULL,  -- For continuation sessions
  related_sop TEXT,                   -- SOP being executed, if applicable

  -- Memory impact
  memories_created TEXT[],            -- Memory file names created
  memories_updated TEXT[],            -- Memory file names updated

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_sessions_started ON claude_sessions(started_at DESC);
CREATE INDEX idx_sessions_domain ON claude_sessions(domain);
CREATE INDEX idx_sessions_source ON claude_sessions(source);
CREATE INDEX idx_sessions_role ON claude_sessions(role);
CREATE INDEX idx_sessions_outcome ON claude_sessions(outcome);
CREATE INDEX idx_sessions_calendar ON claude_sessions(calendar_event_id);

-- Full-text search on summary and topics
CREATE INDEX idx_sessions_summary_search ON claude_sessions USING gin(to_tsvector('english', summary));

-- =============================================================================
-- KNOWLEDGE AUDIT LOG — Tracks memory/knowledge health over time
-- =============================================================================

CREATE TABLE knowledge_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  auditor TEXT DEFAULT 'claude',      -- 'claude' or user name

  -- What was reviewed
  memory_file TEXT NOT NULL,          -- File name (e.g., 'project_shos_app_roadmap.md')
  memory_type TEXT,                   -- 'user', 'feedback', 'project', 'reference'

  -- Assessment
  action TEXT NOT NULL,               -- 'keep', 'update', 'archive', 'delete', 'merge'
  reason TEXT,                        -- Why this action was taken
  merged_into TEXT,                   -- If merged, which file absorbed it

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_audit_date ON knowledge_audit_log(audit_date);
CREATE INDEX idx_knowledge_audit_file ON knowledge_audit_log(memory_file);

-- =============================================================================
-- VIEW: Recent sessions by domain (for dashboard)
-- =============================================================================

CREATE VIEW v_recent_sessions AS
SELECT
  id,
  started_at,
  duration_minutes,
  source,
  domain,
  role,
  summary,
  outcome,
  efficiency_rating,
  array_length(decisions_made::text[]::text[], 1) as decision_count,
  array_length(artifacts_produced, 1) as artifact_count,
  array_length(follow_up_items::text[]::text[], 1) as follow_up_count,
  calendar_event_id
FROM claude_sessions
ORDER BY started_at DESC
LIMIT 50;

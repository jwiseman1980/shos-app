-- Migration: hero workflow pipeline
-- Adds a single column tracking each hero's position in the 15-stage bracelet lifecycle.
-- Apply via Supabase dashboard SQL editor or `supabase db push`.

-- Stage values, in order:
--   1. inquiry              - initial request received
--   2. researching          - gathering hero info
--   3. hero_created         - record in heroes table
--   4. contacting_requestor - confirming details / family approval / sizes
--   5. design_briefed       - brief sent to Ryan (Slack)
--   6. design_received      - SVGs uploaded to Storage
--   7. proof_sent           - proof sent to requestor
--   8. approved_production  - order created, items ready_to_laser
--   9. lasering             - on the laser
--  10. photographing        - shaped, photographed, photos uploaded
--  11. letter_drafted       - family letter drafted
--  12. social_posted        - social posts created
--  13. shipped              - shipped via ShipStation
--  14. listed               - live on website
--  15. complete             - anniversary tracking set, lifecycle done

ALTER TABLE heroes
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT,
  ADD COLUMN IF NOT EXISTS workflow_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workflow_blockers TEXT;

ALTER TABLE heroes
  DROP CONSTRAINT IF EXISTS heroes_workflow_stage_check;

ALTER TABLE heroes
  ADD CONSTRAINT heroes_workflow_stage_check
  CHECK (workflow_stage IS NULL OR workflow_stage IN (
    'inquiry',
    'researching',
    'hero_created',
    'contacting_requestor',
    'design_briefed',
    'design_received',
    'proof_sent',
    'approved_production',
    'lasering',
    'photographing',
    'letter_drafted',
    'social_posted',
    'shipped',
    'listed',
    'complete'
  ));

CREATE INDEX IF NOT EXISTS idx_heroes_workflow_stage
  ON heroes(workflow_stage)
  WHERE workflow_stage IS NOT NULL AND workflow_stage <> 'complete';

-- Backfill: existing rows get a sensible default based on current state.
-- Heroes already on the website with a design → 'listed'.
-- Heroes with a design uploaded but not yet active → 'design_received'.
-- Heroes with a design brief but no design → 'design_briefed'.
-- Everyone else → 'hero_created'.
UPDATE heroes
SET workflow_stage = CASE
  WHEN active_listing = TRUE AND has_graphic_design = TRUE THEN 'listed'
  WHEN has_graphic_design = TRUE THEN 'design_received'
  WHEN design_brief IS NOT NULL THEN 'design_briefed'
  ELSE 'hero_created'
END,
workflow_updated_at = NOW()
WHERE workflow_stage IS NULL;

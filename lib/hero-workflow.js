// Hero Workflow — single source of truth for the 15-stage bracelet lifecycle.
// Imported by API routes (validation, advancement) and the pipeline UI (rendering).

import { getServerClient } from "@/lib/supabase";

export const STAGES = [
  { key: "inquiry",              label: "Inquiry",              short: "Inquiry received" },
  { key: "researching",          label: "Researching",          short: "Researching hero" },
  { key: "hero_created",         label: "Hero Created",         short: "Hero record in Supabase" },
  { key: "contacting_requestor", label: "Confirming Details",   short: "Sizes / family approval" },
  { key: "design_briefed",       label: "Design Briefed",       short: "Brief sent to Ryan" },
  { key: "design_received",      label: "Design Received",      short: "SVGs uploaded to Storage" },
  { key: "proof_sent",           label: "Proof Sent",           short: "Proof to requestor" },
  { key: "approved_production",  label: "Approved → Production", short: "Order ready_to_laser" },
  { key: "lasering",             label: "Lasering",             short: "On the laser" },
  { key: "photographing",        label: "Photographed",         short: "Shaped + photos uploaded" },
  { key: "letter_drafted",       label: "Letter Drafted",       short: "Family letter ready" },
  { key: "social_posted",        label: "Social Posted",        short: "Social posts created" },
  { key: "shipped",              label: "Shipped",              short: "Out via ShipStation" },
  { key: "listed",               label: "Listed",               short: "Live on website" },
  { key: "complete",             label: "Complete",             short: "Anniversary tracked" },
];

export const STAGE_KEYS = STAGES.map((s) => s.key);
export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));

export function isValidStage(stage) {
  return stage && STAGE_INDEX[stage] !== undefined;
}

export function nextStage(stage) {
  const i = STAGE_INDEX[stage];
  if (i === undefined) return STAGES[0].key;
  if (i >= STAGES.length - 1) return null;
  return STAGES[i + 1].key;
}

// Advance a hero to a target stage (or to the next stage if no target given).
// Refuses to skip stages unless { allowSkip: true } — keeps the pipeline honest.
// Refuses to move backwards unless { allowRewind: true }.
export async function advanceWorkflow(heroId, targetStage, opts = {}) {
  if (!heroId) return { success: false, error: "heroId required" };

  const sb = getServerClient();
  const { data: hero, error: readErr } = await sb
    .from("heroes")
    .select("id, workflow_stage")
    .eq("id", heroId)
    .maybeSingle();

  if (readErr) return { success: false, error: readErr.message };
  if (!hero) return { success: false, error: "Hero not found" };

  const current = hero.workflow_stage || "hero_created";
  const target = targetStage || nextStage(current);
  if (!target) return { success: false, error: "Already at final stage" };
  if (!isValidStage(target)) return { success: false, error: `Invalid stage: ${target}` };

  const ci = STAGE_INDEX[current] ?? -1;
  const ti = STAGE_INDEX[target];

  if (ti < ci && !opts.allowRewind) {
    return { success: false, error: `Cannot rewind from ${current} to ${target}` };
  }
  if (ti > ci + 1 && !opts.allowSkip) {
    return {
      success: false,
      error: `Cannot skip from ${current} to ${target} — advance one stage at a time`,
    };
  }

  // No-op if already at the target stage. Don't error — idempotent advances are
  // useful when wiring this into existing routes that may fire more than once.
  if (ti === ci) return { success: true, hero, stage: current, noop: true };

  const update = {
    workflow_stage: target,
    workflow_updated_at: new Date().toISOString(),
  };
  if (opts.blockers !== undefined) update.workflow_blockers = opts.blockers;

  const { data: updated, error: updErr } = await sb
    .from("heroes")
    .update(update)
    .eq("id", heroId)
    .select("id, name, workflow_stage, workflow_updated_at, workflow_blockers")
    .single();

  if (updErr) return { success: false, error: updErr.message };
  return { success: true, hero: updated, stage: target, previous: current };
}

// Best-effort variant for use inside existing routes — never throws.
// Idempotent: if the hero is already past the target stage, it is left alone.
export async function tryAdvanceWorkflow(heroId, targetStage, opts = {}) {
  try {
    if (!heroId) return null;
    const sb = getServerClient();
    const { data: hero } = await sb
      .from("heroes")
      .select("workflow_stage")
      .eq("id", heroId)
      .maybeSingle();
    if (!hero) return null;
    const current = hero.workflow_stage || "hero_created";
    const ci = STAGE_INDEX[current] ?? -1;
    const ti = STAGE_INDEX[targetStage] ?? -1;
    // Don't move backwards in the auto-wiring path. The PATCH API has explicit rewind.
    if (ti <= ci) return null;
    return await advanceWorkflow(heroId, targetStage, { allowSkip: true, ...opts });
  } catch (err) {
    console.warn("[hero-workflow] tryAdvanceWorkflow failed:", err.message);
    return null;
  }
}

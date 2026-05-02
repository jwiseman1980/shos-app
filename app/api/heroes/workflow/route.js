import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import {
  STAGES,
  STAGE_INDEX,
  STAGE_LABEL,
  advanceWorkflow,
  isValidStage,
} from "@/lib/hero-workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/heroes/workflow
//   Returns every hero with a workflow_stage, grouped by stage,
//   plus a derived "blocker" hint when one is obvious from related state.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const includeComplete = searchParams.get("includeComplete") === "true";

  const sb = getServerClient();
  let { data, error } = await sb
    .from("heroes")
    .select(`
      id, name, first_name, last_name, rank, lineitem_sku, branch,
      workflow_stage, workflow_updated_at, workflow_blockers,
      design_status, has_graphic_design, active_listing,
      family_contact:contacts_legacy!family_contact_id(first_name, last_name, email)
    `)
    .not("workflow_stage", "is", null)
    .order("workflow_updated_at", { ascending: false });

  // Migration not applied yet: workflow_* columns are absent. Return an empty
  // pipeline rather than 500 so the page still renders with a clear empty state.
  if (error && /workflow_(stage|updated_at|blockers)|schema cache/i.test(error.message)) {
    return NextResponse.json({
      success: true,
      stages: STAGES,
      byStage: Object.fromEntries(STAGES.map((s) => [s.key, []])),
      counts: Object.fromEntries(STAGES.map((s) => [s.key, 0])),
      total: 0,
      migrationPending: true,
      generatedAt: new Date().toISOString(),
    });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byStage = Object.fromEntries(STAGES.map((s) => [s.key, []]));
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0]));

  for (const hero of data || []) {
    const stage = hero.workflow_stage;
    if (!isValidStage(stage)) continue;
    if (!includeComplete && stage === "complete") continue;

    const fullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ") || hero.name;
    const fc = hero.family_contact;
    const familyName = fc ? `${fc.first_name || ""} ${fc.last_name || ""}`.trim() : null;

    byStage[stage].push({
      id: hero.id,
      name: fullName,
      sku: hero.lineitem_sku,
      branch: hero.branch,
      stage,
      stageLabel: STAGE_LABEL[stage],
      updatedAt: hero.workflow_updated_at,
      blockers: hero.workflow_blockers || deriveBlocker(hero),
      familyContact: familyName ? { name: familyName, email: fc?.email || null } : null,
    });
    counts[stage] += 1;
  }

  return NextResponse.json({
    success: true,
    stages: STAGES,
    byStage,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    generatedAt: new Date().toISOString(),
  });
}

// PATCH /api/heroes/workflow
//   Body: { hero_id, stage?, blockers?, allowSkip?, allowRewind? }
//   - stage omitted → advance to the next stage
//   - stage provided → advance to that exact stage (validates one-step rule unless allowSkip)
export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { hero_id, stage, blockers, allowSkip, allowRewind } = body;
  if (!hero_id) {
    return NextResponse.json({ error: "hero_id is required" }, { status: 400 });
  }

  const result = await advanceWorkflow(hero_id, stage || null, {
    allowSkip: Boolean(allowSkip),
    allowRewind: Boolean(allowRewind),
    blockers: blockers !== undefined ? blockers : undefined,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    hero: result.hero,
    stage: result.stage,
    previous: result.previous || null,
    noop: Boolean(result.noop),
  });
}

// Derive a soft "what's blocking" hint from related hero state when no explicit
// blocker is set. The PATCH endpoint can override these by passing blockers.
function deriveBlocker(hero) {
  const stage = hero.workflow_stage;
  switch (stage) {
    case "design_briefed":
      return hero.has_graphic_design ? null : "Waiting on Ryan for SVGs";
    case "design_received":
      return "Send proof to requestor";
    case "proof_sent":
      return "Waiting on requestor approval";
    case "approved_production":
      return "Items ready_to_laser — start laser run";
    case "listed":
      return hero.active_listing ? "Set anniversary tracking to mark complete" : "Publish active_listing on website";
    case "hero_created":
      return "Reach out to requestor to confirm sizes / family approval";
    default:
      return null;
  }
}

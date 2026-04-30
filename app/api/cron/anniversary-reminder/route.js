/**
 * Anniversary Reminder Cron
 *
 * Runs daily at 9 AM UTC (5 AM ET). Finds heroes with anniversaries
 * in the next 7 days and skips heroes whose anniversary_status marks
 * outreach as already handled (sent / scheduled / complete / skipped).
 * Posts a Slack alert for any that still need action.
 *
 * Replaces the former Notion-based reminder that queried the
 * "Anniversary Remembrance Tracker" database (now offline).
 */

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { postToSlack } from "@/lib/slack";
import { createTask } from "@/lib/storage/supabase-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();
  const now = new Date();

  // anniversary_status values that mean outreach is already handled —
  // skip these heroes. The `anniversary_emails` table is unused (zero
  // rows, no writers) so we read state directly off heroes.
  const HANDLED_STATUSES = new Set(["sent", "scheduled", "complete", "skipped"]);

  // Build month/day targets for the next 14 days (including today)
  const targets = [];
  for (let offset = 0; offset <= 14; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    targets.push({ month: d.getMonth() + 1, day: d.getDate(), offset });
  }

  // Fetch active heroes with anniversary data
  const { data: allHeroes, error: heroErr } = await sb
    .from("heroes")
    .select("id, name, rank, first_name, last_name, memorial_month, memorial_day, anniversary_status, lineitem_sku")
    .eq("active_listing", true)
    .not("memorial_month", "is", null)
    .not("memorial_day", "is", null);

  if (heroErr) {
    console.error("[anniversary-reminder] Heroes query failed:", heroErr.message);
    return NextResponse.json({ error: heroErr.message }, { status: 500 });
  }

  // Match heroes whose anniversary falls within the next 7 days
  const matched = [];
  for (const h of allHeroes || []) {
    const m = Number(h.memorial_month);
    const d = Number(h.memorial_day);
    const target = targets.find((t) => t.month === m && t.day === d);
    if (target) matched.push({ ...h, daysUntil: target.offset });
  }

  if (matched.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No anniversaries in next 7 days",
      heroesChecked: allHeroes?.length || 0,
    });
  }

  // Use anniversary_status off the heroes row itself — that's the
  // field the operator UI writes to (anniversary_emails was never wired up).
  const needsAction = matched.filter((h) => !HANDLED_STATUSES.has(h.anniversary_status));
  const alreadyHandled = matched.filter((h) => HANDLED_STATUSES.has(h.anniversary_status));

  if (needsAction.length === 0) {
    return NextResponse.json({
      success: true,
      message: `All ${matched.length} upcoming anniversaries already handled`,
      matchedHeroes: matched.length,
    });
  }

  // Sort by days until anniversary
  needsAction.sort((a, b) => a.daysUntil - b.daysUntil);

  // Auto-create tasks for heroes that don't already have an open anniversary task
  const heroIdsNeedingAction = needsAction.map((h) => h.id);
  const { data: existingTasks } = await sb
    .from("tasks")
    .select("source_id")
    .eq("source_type", "anniversary")
    .in("source_id", heroIdsNeedingAction)
    .not("status", "in", '("done","cancelled")');

  const alreadyHasTask = new Set((existingTasks || []).map((t) => t.source_id));

  // Per the new flow, Chris ASSIGNS volunteers — she is not the default assignee.
  // Tasks are created unassigned; Chris assigns them via /anniversaries.
  const tasksCreated = [];
  for (const h of needsAction) {
    if (alreadyHasTask.has(h.id)) continue;
    const heroName = [h.rank, h.first_name, h.last_name].filter(Boolean).join(" ") || h.name;
    const dateStr = `${h.memorial_month}/${h.memorial_day}`;
    const daysLabel = h.daysUntil === 0 ? "TODAY" : h.daysUntil === 1 ? "tomorrow" : `in ${h.daysUntil} days`;
    await createTask({
      title: `Send anniversary outreach — ${heroName} — ${dateStr}`,
      description: `Anniversary is ${daysLabel}. Chris: assign a volunteer in /anniversaries.`,
      priority: h.daysUntil <= 2 ? "high" : "medium",
      role: "operator",
      domain: "comms",
      source_type: "anniversary",
      source_id: h.id,
      due_date: (() => {
        const d = new Date(now);
        d.setDate(d.getDate() + h.daysUntil);
        return d.toISOString().split("T")[0];
      })(),
      assigned_to: null,
      tags: ["anniversary", "outreach"],
    });
    tasksCreated.push(heroName);
  }

  // Build Slack alert
  const currentYear = now.getFullYear();
  const lines = [`🕯️ *Anniversary Reminder — Action Needed*`];
  lines.push(`${needsAction.length} hero${needsAction.length === 1 ? "" : "es"} with upcoming anniversaries have no family email sent for ${currentYear}:\n`);

  for (const h of needsAction) {
    const name = [h.rank, h.first_name, h.last_name].filter(Boolean).join(" ") || h.name;
    const dateStr = `${h.memorial_month}/${h.memorial_day}`;
    const daysLabel = h.daysUntil === 0 ? "*TODAY*" : h.daysUntil === 1 ? "tomorrow" : `in ${h.daysUntil} days`;
    const statusNote = h.anniversary_status ? ` · status: ${h.anniversary_status}` : "";
    lines.push(`• ${name} — ${dateStr} (${daysLabel}${statusNote})`);
  }

  if (alreadyHandled.length > 0) {
    const names = alreadyHandled.map((h) => h.name || `${h.first_name} ${h.last_name}`).join(", ");
    lines.push(`\n✅ Already handled: ${names}`);
  }

  if (tasksCreated.length > 0) {
    lines.push(`\n📋 Tasks auto-created (unassigned) for: ${tasksCreated.join(", ")}`);
    lines.push(`Chris: assign volunteers in /anniversaries — they get a Slack DM with a Create Draft button.`);
  }
  lines.push(`\nOpen /anniversaries to assign volunteers and trigger drafts.`);

  const message = lines.join("\n");
  await postToSlack("joseph", message).catch(() => {});
  await postToSlack("ops", message).catch(() => {});

  return NextResponse.json({
    success: true,
    upcoming: matched.length,
    needsAction: needsAction.length,
    alreadyHandled: alreadyHandled.length,
    tasksCreated: tasksCreated.length,
    heroes: needsAction.map((h) => ({
      name: h.name || `${h.first_name} ${h.last_name}`,
      month: h.memorial_month,
      day: h.memorial_day,
      daysUntil: h.daysUntil,
      anniversaryStatus: h.anniversary_status,
    })),
  });
}

/**
 * Execution Logger
 *
 * Records completed work to Supabase execution_log.
 * Called by the PriorityQueue component when a user clicks "Done".
 */

import { getServerClient } from "@/lib/supabase";
import { logExecutionToCalendar } from "@/lib/calendar";

/**
 * Log a completed execution.
 * @param {object} params
 * @param {string} params.userName
 * @param {string} params.itemType — task, outreach, recurring, donor, etc.
 * @param {string} params.itemId — source record ID
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.domain
 * @param {string} params.startedAt — ISO timestamp
 * @param {number} params.estimatedMinutes
 * @param {string} params.outcome — what was accomplished
 * @param {string} params.impactMetric — e.g. "1 family reached"
 */
export async function logExecution({
  userName,
  itemType,
  itemId,
  title,
  description,
  domain,
  startedAt,
  estimatedMinutes,
  outcome,
  impactMetric,
}) {
  const sb = getServerClient();
  const completedAt = new Date().toISOString();

  // Calculate duration
  let durationMinutes = null;
  if (startedAt) {
    durationMinutes = Math.round(
      (new Date(completedAt) - new Date(startedAt)) / 60000
    );
    // Cap at 4 hours — if longer, they probably forgot to start the timer
    if (durationMinutes > 240) durationMinutes = null;
  }

  // Look up user ID
  let userId = null;
  if (userName) {
    const { data: user } = await sb
      .from("users")
      .select("id")
      .ilike("name", userName)
      .limit(1)
      .single();
    userId = user?.id || null;
  }

  const { data, error } = await sb.from("execution_log").insert({
    user_id: userId,
    user_name: userName,
    item_type: itemType,
    item_id: itemId,
    title,
    description,
    domain,
    started_at: startedAt,
    completed_at: completedAt,
    duration_minutes: durationMinutes,
    estimated_minutes: estimatedMinutes,
    outcome,
    impact_metric: impactMetric,
  }).select("id").single();

  if (error) {
    console.error("[execution-logger] Failed:", error.message);
    return { success: false, error: error.message };
  }

  // Also update task status to "done" if this was a task
  if (itemType === "task" && itemId && !itemId.startsWith("sop-") && !itemId.startsWith("anniversary-") && !itemId.startsWith("donor-")) {
    await sb.from("tasks")
      .update({ status: "done", completed_at: completedAt, updated_at: completedAt })
      .eq("id", itemId)
      .catch(() => {}); // Best effort
  }

  // Also log to Google Calendar (best effort, don't block)
  logExecutionToCalendar({
    domain,
    title,
    outcome,
    startedAt,
    completedAt,
    durationMinutes,
  }).catch((err) => {
    console.error("[execution-logger] Calendar log failed:", err.message);
  });

  return { success: true, id: data?.id, durationMinutes };
}

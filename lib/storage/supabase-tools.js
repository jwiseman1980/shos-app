/**
 * Supabase Tool Implementations
 *
 * Functions backing the Operator chat tools:
 * - supabase_query: query any table
 * - supabase_upsert: insert/update records in any existing table
 * - create_task, update_task, query_tasks: task management
 * - log_closeout: session closeout records
 * - log_engagement: engagement tracking
 */

import { getServerClient } from "@/lib/supabase";
import { logExecution } from "@/lib/execution-logger";

// ---------------------------------------------------------------------------
// Generic query — lets agents query any Supabase table with filters
// ---------------------------------------------------------------------------

export async function supabaseQuery({ table, select = "*", filters = {}, limit = 50, order = null }) {
  const supabase = getServerClient();
  let query = supabase.from(table).select(select).limit(limit);

  // Apply filters: { column: value } or { column: { op: "gte", value: "2026-01-01" } }
  for (const [col, val] of Object.entries(filters)) {
    if (val && typeof val === "object" && val.op) {
      query = query[val.op](col, val.value);
    } else {
      query = query.eq(col, val);
    }
  }

  if (order) {
    const desc = order.startsWith("-");
    const col = desc ? order.slice(1) : order;
    query = query.order(col, { ascending: !desc });
  }

  const { data, error } = await query;

  if (error) return `Query failed: ${error.message}`;
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Generic upsert — lets agents write to any existing table
// ---------------------------------------------------------------------------

export async function supabaseUpsert({ table, records, on_conflict }) {
  const supabase = getServerClient();

  if (!records || records.length === 0) {
    return "No records provided — nothing to upsert.";
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .upsert(records, on_conflict ? { onConflict: on_conflict, ignoreDuplicates: false } : undefined)
      .select("id");

    if (error) return `Upsert failed on ${table}: ${error.message}`;
    return `Upserted ${data?.length ?? records.length} record(s) into ${table}.`;
  } catch (e) {
    return `Upsert error: ${e.message}`;
  }
}

// ---------------------------------------------------------------------------
// Task management
// ---------------------------------------------------------------------------

export async function createTask({ title, description, priority = "medium", role, assigned_to, due_date, domain, hero_id, organization_id, sop_ref, tags }) {
  const supabase = getServerClient();
  const { data, error } = await supabase.from("tasks").insert({
    title,
    description,
    priority,
    role,
    assigned_to,
    due_date,
    domain,
    hero_id,
    organization_id,
    sop_ref,
    tags,
    status: "todo",
  }).select("id, title, priority, role, due_date").single();

  if (error) return `Failed to create task: ${error.message}`;
  return `Task created: "${title}" [${priority}] assigned to ${role || "unassigned"}${due_date ? ` due ${due_date}` : ""} (id: ${data.id})`;
}

export async function updateTask({ task_id, status, priority, assigned_to, notes }) {
  const supabase = getServerClient();
  const updates = {};
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if (assigned_to !== undefined) updates.assigned_to = assigned_to;
  if (notes) updates.notes = notes;
  if (status === "done") updates.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", task_id)
    .select("id, title, status, priority, role")
    .single();

  if (error) return `Failed to update task: ${error.message}`;

  // Log accomplishment when task is completed
  if (status === "done" && data) {
    logExecution({
      userName: assigned_to || "Joseph Wiseman",
      itemType: "task",
      itemId: task_id,
      title: data.title,
      description: notes || `Task completed: ${data.title}`,
      domain: data.role || "operations",
      outcome: notes || "Completed",
      impactMetric: "1 task completed",
    }).catch(() => {}); // Best effort — don't block the response
  }

  return `Task updated: "${data.title}" → ${data.status} [${data.priority}]`;
}

export async function queryTasks({ role, status, assigned_to, priority, due_before, limit = 20 }) {
  const supabase = getServerClient();
  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, role, due_date, assigned_to, tags, created_at")
    .limit(limit)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);
  if (assigned_to) query = query.eq("assigned_to", assigned_to);
  if (priority) query = query.eq("priority", priority);
  if (due_before) query = query.lte("due_date", due_before);

  const { data, error } = await query;

  if (error) return `Query failed: ${error.message}`;
  if (!data || data.length === 0) return "No tasks found matching those filters.";
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Session closeout
// ---------------------------------------------------------------------------

export async function logCloseout({ role, summary, decisions_made = [], artifacts_created = [], follow_ups = [] }) {
  const supabase = getServerClient();
  const { data, error } = await supabase.from("closeouts").insert({
    role,
    summary,
    decisions_made,
    artifacts_created,
    follow_ups,
    status: "processed",
    session_date: new Date().toISOString().split("T")[0],
    processed_date: new Date().toISOString().split("T")[0],
  }).select("id").single();

  if (error) return `Failed to log closeout: ${error.message}`;
  return `Session closeout recorded (id: ${data.id}). Decisions: ${decisions_made.length}, Follow-ups: ${follow_ups.length}`;
}

// ---------------------------------------------------------------------------
// Engagement logging
// ---------------------------------------------------------------------------

export async function logEngagement({ type, subject, description, contact_id, organization_id, hero_id, outcome, follow_up_needed = false, follow_up_date }) {
  const supabase = getServerClient();
  const { data, error } = await supabase.from("engagements").insert({
    type,
    subject,
    description,
    contact_id,
    organization_id,
    hero_id,
    outcome,
    follow_up_needed,
    follow_up_date,
    engagement_date: new Date().toISOString().split("T")[0],
  }).select("id, subject, type").single();

  if (error) return `Failed to log engagement: ${error.message}`;
  return `Engagement logged: [${data.type}] "${data.subject}" (id: ${data.id})`;
}

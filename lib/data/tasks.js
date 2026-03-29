/**
 * Tasks Data Layer — Supabase
 *
 * Queries the tasks table for the Tasks page and role agents.
 */

import { getServerClient } from "@/lib/supabase";

export async function getTasks(filters = {}) {
  const sb = getServerClient();
  let query = sb
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.role) query = query.eq("role", filters.role);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);

  // Exclude done/cancelled by default unless explicitly requested
  if (!filters.status && !filters.includeCompleted) {
    query = query.not("status", "in", '("done","cancelled")');
  }

  const { data, error } = await query;
  if (error) {
    console.error("[tasks] getTasks error:", error.message);
    return [];
  }
  return data || [];
}

export async function getTaskStats() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("tasks")
    .select("status, priority, role");

  if (error) {
    console.error("[tasks] getTaskStats error:", error.message);
    return { total: 0, todo: 0, inProgress: 0, blocked: 0, done: 0, byRole: {}, byPriority: {} };
  }

  const tasks = data || [];
  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    blocked: tasks.filter(t => t.status === "blocked").length,
    done: tasks.filter(t => t.status === "done").length,
    backlog: tasks.filter(t => t.status === "backlog").length,
    byRole: {},
    byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
  };

  for (const t of tasks) {
    if (t.status === "done" || t.status === "cancelled") continue;
    if (t.role) stats.byRole[t.role] = (stats.byRole[t.role] || 0) + 1;
    if (t.priority) stats.byPriority[t.priority]++;
  }

  return stats;
}

export async function getTasksByRole() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .not("status", "in", '("done","cancelled")')
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[tasks] getTasksByRole error:", error.message);
    return {};
  }

  const grouped = {};
  for (const task of (data || [])) {
    const role = task.role || "unassigned";
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(task);
  }
  return grouped;
}

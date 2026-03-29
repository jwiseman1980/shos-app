/**
 * Supabase Storage Adapter
 *
 * Primary storage backend for Steel Hearts.
 * Uses the knowledge_files and friction_logs tables in Supabase.
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { getServerClient } from "@/lib/supabase";

/**
 * Read a role's knowledge file content from Supabase.
 * @param {string} role — cos, cfo, coo, comms, dev, family, ed
 * @returns {Promise<string>} markdown content
 */
export async function readKnowledge(role) {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("knowledge_files")
    .select("content")
    .eq("role", role)
    .single();

  if (error) {
    // If no row exists yet, return empty string (not an error)
    if (error.code === "PGRST116") return "";
    console.error(`[supabase] readKnowledge(${role}) error:`, error.message);
    return "";
  }

  return data?.content || "";
}

/**
 * Write (upsert) a role's knowledge file content to Supabase.
 * Increments session_count and updates last_updated.
 * @param {string} role
 * @param {string} content — full markdown content
 */
export async function writeKnowledge(role, content) {
  const supabase = getServerClient();

  // Try update first
  const { data: existing } = await supabase
    .from("knowledge_files")
    .select("id, session_count")
    .eq("role", role)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("knowledge_files")
      .update({
        content,
        session_count: (existing.session_count || 0) + 1,
        last_updated: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error(`[supabase] writeKnowledge(${role}) update error:`, error.message);
      return `Failed to update knowledge file: ${error.message}`;
    }
    return `Knowledge file updated for ${role} (session #${(existing.session_count || 0) + 1})`;
  }

  // Insert new row
  const { error } = await supabase.from("knowledge_files").insert({
    name: `${role.toUpperCase()} Knowledge File`,
    role,
    content,
    session_count: 1,
    last_updated: new Date().toISOString(),
  });

  if (error) {
    console.error(`[supabase] writeKnowledge(${role}) insert error:`, error.message);
    return `Failed to create knowledge file: ${error.message}`;
  }
  return `Knowledge file created for ${role}`;
}

/**
 * Log a friction item to Supabase friction_logs table.
 */
export async function logFriction(role, type, priority, description) {
  const supabase = getServerClient();
  const { error } = await supabase.from("friction_logs").insert({
    role,
    type,
    priority,
    description,
    status: "open",
    logged_date: new Date().toISOString().split("T")[0],
  });

  if (error) {
    console.error(`[supabase] logFriction error:`, error.message);
    return `Failed to log friction: ${error.message}`;
  }
  return `Friction logged: [${priority}] ${type} — ${description}`;
}

/**
 * Read friction items from Supabase.
 */
export async function readFriction(statusFilter = null) {
  const supabase = getServerClient();
  let query = supabase
    .from("friction_logs")
    .select("*")
    .order("logged_date", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[supabase] readFriction error:`, error.message);
    return [];
  }
  return data || [];
}

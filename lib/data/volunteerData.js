/**
 * Volunteers Data Layer — Supabase
 */

import { getServerClient } from "@/lib/supabase";

export async function getVolunteers(filters = {}) {
  const sb = getServerClient();
  let query = sb
    .from("volunteers")
    .select("*")
    .order("last_name", { ascending: true });

  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) {
    console.error("[volunteers] getVolunteers error:", error.message);
    return [];
  }
  return data || [];
}

export async function getVolunteerStats() {
  const sb = getServerClient();
  const { data, error } = await sb.from("volunteers").select("status");

  if (error) return { total: 0, active: 0, onboarding: 0, prospect: 0, inactive: 0 };

  const vols = data || [];
  return {
    total: vols.length,
    active: vols.filter(v => v.status === "active").length,
    onboarding: vols.filter(v => v.status === "onboarding").length,
    prospect: vols.filter(v => v.status === "prospect").length,
    inactive: vols.filter(v => v.status === "inactive").length,
  };
}

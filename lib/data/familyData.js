/**
 * Families (Contacts) Data Layer — Supabase
 */

import { getServerClient } from "@/lib/supabase";

export async function getFamilyContacts() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("contacts")
    .select("*, organization:organizations(name)")
    .order("last_name", { ascending: true });

  if (error) {
    console.error("[families] getFamilyContacts error:", error.message);
    return [];
  }
  return data || [];
}

export async function getFamilyStats() {
  const sb = getServerClient();

  const [{ count: totalContacts }, { count: withEmail }, { count: linkedHeroes }] = await Promise.all([
    sb.from("contacts").select("*", { count: "exact", head: true }),
    sb.from("contacts").select("*", { count: "exact", head: true }).not("email", "is", null),
    sb.from("hero_associations").select("*", { count: "exact", head: true }),
  ]);

  return {
    total: totalContacts || 0,
    withEmail: withEmail || 0,
    withoutEmail: (totalContacts || 0) - (withEmail || 0),
    heroLinks: linkedHeroes || 0,
  };
}

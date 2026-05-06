// One-off: find Voss hero(es) and mark anniversary as complete.
// Joseph spoke to Marcy directly on 2026-05-06.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

try {
  const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch (e) {
  console.warn("env load:", e.message);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: heroes, error } = await sb
  .from("heroes")
  .select("id, sf_id, name, lineitem_sku, anniversary_status, anniversary_outreach_status, anniversary_completed_date, anniversary_notes")
  .ilike("name", "%voss%");
if (error) throw error;

console.log(`Found ${heroes.length} hero(es) matching Voss:`);
for (const h of heroes) {
  console.log(`  ${h.name} | sku=${h.lineitem_sku} | status=${h.anniversary_status} | completed=${h.anniversary_completed_date} | outreach=${h.anniversary_outreach_status}`);
  console.log(`    notes: ${h.anniversary_notes || "(none)"}`);
}

const args = process.argv.slice(2);
const dryRun = !args.includes("--apply");

if (dryRun) {
  console.log("\n[DRY RUN] Pass --apply to actually update.");
  process.exit(0);
}

// Update all matched heroes. If multiple, Joseph can flag a different one later.
const noteAddition = `[2026-05-06] Joseph spoke to Marcy directly — anniversary outreach complete.`;
const results = [];
for (const h of heroes) {
  const newNotes = [h.anniversary_notes, noteAddition].filter(Boolean).join("\n");
  const { error: upErr } = await sb
    .from("heroes")
    .update({
      anniversary_status: "complete",
      anniversary_completed_date: "2026-05-06",
      anniversary_notes: newNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", h.id);
  results.push({ name: h.name, ok: !upErr, error: upErr?.message });
}
console.log("\nUpdate results:");
for (const r of results) {
  console.log(`  ${r.ok ? "OK" : "FAIL"} ${r.name}${r.error ? " — " + r.error : ""}`);
}

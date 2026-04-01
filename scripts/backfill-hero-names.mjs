/**
 * backfill-hero-names.mjs
 *
 * For every hero in data/heroes.json, parse the fullName into
 * rank / first_name / last_name and upsert into Supabase heroes
 * rows that currently have empty first_name/last_name.
 *
 * Run with:
 *   node --env-file=.env.local scripts/backfill-hero-names.mjs
 *
 * Or dry-run (no writes):
 *   DRY_RUN=true node --env-file=.env.local scripts/backfill-hero-names.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const heroesJson = JSON.parse(
  readFileSync(resolve(__dirname, "../data/heroes.json"), "utf-8")
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN === "true";

const looksLikeSfId = (s) => s && /^a0u/i.test(s);

/**
 * Parse a fullName like:
 *   "CPT James F. Adamouski (USMA '95)"
 *   "SFC Brent A. Adams"
 *   "1st Lt Kenneth \"KAGE\" Allen (USAFA '17)"
 *   "MIDN 1/C Max Allen (USNA '14)"
 *   "COL Brian D. Allgood, MD (USMA '82)"
 *
 * Returns { first, last } using the pre-parsed rank from the JSON record.
 */
function parseName(fullName, rank) {
  let s = fullName.trim();

  // Strip trailing parenthetical class year: " (USMA '95)" etc.
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim();

  // Strip rank prefix (rank may contain spaces like "MIDN 1/C" or "1st Lt")
  if (rank && s.startsWith(rank)) {
    s = s.slice(rank.length).trim();
  }

  // Strip professional suffix after comma: ", MD", ", Jr.", etc.
  s = s.replace(/,\s*\S+$/, "").trim();

  // Strip nickname in quotes: ' "KAGE"'
  s = s.replace(/\s+"[^"]*"/, "").trim();

  // Remaining tokens: first [middle_initial] last
  const tokens = s.split(/\s+/);
  if (tokens.length === 0) return { first: null, last: null };
  if (tokens.length === 1) return { first: tokens[0], last: null };

  // First token = first name, last token = last name (middle initial between)
  return { first: tokens[0], last: tokens[tokens.length - 1] };
}

async function main() {
  console.log(`Processing ${heroesJson.length} heroes from heroes.json…`);
  if (DRY_RUN) console.log("DRY RUN — no writes will be made.\n");

  // Fetch all heroes from Supabase to know which ones need backfill
  const { data: supabaseHeroes, error } = await supabase
    .from("heroes")
    .select("id, sf_id, name, first_name, last_name, rank");

  if (error) {
    console.error("Failed to fetch heroes from Supabase:", error.message);
    process.exit(1);
  }

  const byId = new Map(supabaseHeroes.map((h) => [h.sf_id, h]));
  console.log(`Found ${supabaseHeroes.length} heroes in Supabase.\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const hero of heroesJson) {
    const row = byId.get(hero.sfId);
    if (!row) {
      console.warn(`  NOT FOUND in Supabase: ${hero.sfId} — ${hero.fullName}`);
      notFound++;
      continue;
    }

    // Skip if already populated with real names (not SF IDs)
    if (
      row.first_name && row.last_name &&
      !looksLikeSfId(row.first_name) && !looksLikeSfId(row.last_name) &&
      !looksLikeSfId(row.name)
    ) {
      skipped++;
      continue;
    }

    const { first, last } = parseName(hero.fullName, hero.rank);
    if (!first && !last) {
      console.warn(`  Could not parse name: "${hero.fullName}"`);
      skipped++;
      continue;
    }

    // Build the display name: "CPT James Adamouski" (no middle initial)
    const displayName = [hero.rank, first, last].filter(Boolean).join(" ");

    console.log(
      `  ${row.sf_id}  "${row.first_name || "(empty)"} ${row.last_name || "(empty)"}"` +
        ` → first="${first}" last="${last}" name="${displayName}"`
    );

    if (!DRY_RUN) {
      const { error: upsertErr } = await supabase
        .from("heroes")
        .update({
          first_name: first,
          last_name: last,
          name: displayName,
        })
        .eq("sf_id", hero.sfId);

      if (upsertErr) {
        console.error(`  ERROR updating ${hero.sfId}:`, upsertErr.message);
        continue;
      }
    }

    updated++;
  }

  console.log(`\nDone (JSON pass). updated=${updated}  skipped=${skipped}  notFound=${notFound}`);

  // --- Phase 2: Fix Supabase heroes where last_name/first_name is a SF ID ---
  // These are heroes added after heroes.json was generated.
  // Their Supabase `name` column has the real full name (e.g. "CPT James Smith").
  console.log("\n--- Phase 2: fixing heroes with SF ID stored as name field ---");

  const { data: badRows, error: badErr } = await supabase
    .from("heroes")
    .select("id, sf_id, name, first_name, last_name, rank")
    .or("last_name.ilike.a0u%,first_name.ilike.a0u%,name.ilike.a0u%");

  if (badErr) {
    console.error("Phase 2 query failed:", badErr.message);
    return;
  }

  console.log(`Found ${badRows.length} heroes with SF-ID-style name fields.\n`);

  let p2updated = 0;
  for (const row of badRows) {
    // Use rank from row (already stored correctly in most cases)
    const rank = looksLikeSfId(row.rank) ? null : row.rank;

    // Prefer the `name` column if it's not itself a SF ID
    const sourceName = (!looksLikeSfId(row.name) && row.name) ? row.name : null;
    if (!sourceName) {
      console.warn(`  No parseable name for ${row.sf_id} — skipping (manual fix needed)`);
      continue;
    }

    const { first, last } = parseName(sourceName, rank);
    if (!first || !last) {
      console.warn(`  Could not parse "${sourceName}" — skipping`);
      continue;
    }

    const displayName = [rank, first, last].filter(Boolean).join(" ");
    console.log(`  ${row.sf_id}  "${row.name}" → first="${first}" last="${last}" name="${displayName}"`);

    if (!DRY_RUN) {
      const { error: updErr } = await supabase
        .from("heroes")
        .update({ first_name: first, last_name: last, name: displayName })
        .eq("id", row.id);

      if (updErr) {
        console.error(`  ERROR: ${updErr.message}`);
        continue;
      }
    }
    p2updated++;
  }

  console.log(`\nPhase 2 done. updated=${p2updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

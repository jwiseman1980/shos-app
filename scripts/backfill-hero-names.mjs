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

    // Skip if already populated
    if (row.first_name && row.last_name) {
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
        .eq("sf_id", hero.sfId)
        .is("first_name", null)
        // Also update if it's an empty string
        ;

      // Supabase .is() only catches null — do a second pass for empty string
      if (!upsertErr) {
        await supabase
          .from("heroes")
          .update({
            first_name: first,
            last_name: last,
            name: displayName,
          })
          .eq("sf_id", hero.sfId)
          .eq("first_name", "");
      }

      if (upsertErr) {
        console.error(`  ERROR updating ${hero.sfId}:`, upsertErr.message);
        continue;
      }
    }

    updated++;
  }

  console.log(`\nDone. updated=${updated}  skipped=${skipped}  notFound=${notFound}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

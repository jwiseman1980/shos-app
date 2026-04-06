#!/usr/bin/env node
/**
 * Write Hero Lifetime Sales to Supabase
 *
 * Reads Hero_Lifetime_Sales_FINAL.csv and updates the heroes table with:
 *   lifetime_sold  — total units sold historically
 *   legacy_skus    — matching source tags from the reconciliation (text[])
 *
 * Matches CSV rows to DB heroes by lineitem_sku = Base_SKU.
 *
 * Prerequisites:
 *   Run scripts/add-lifetime-sales-columns.sql in Supabase SQL Editor first.
 *
 * Usage:
 *   node scripts/write-lifetime-sales.mjs [path-to-csv]
 *   # Default CSV path: ~/Downloads/Hero_Lifetime_Sales_FINAL.csv
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with embedded commas and escaped quotes
// ---------------------------------------------------------------------------
function parseCSVLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"')                    { inQuotes = false; }
      else                                    { field += ch; }
    } else {
      if      (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field); field = ""; }
      else                 { field += ch; }
    }
  }
  fields.push(field);
  return fields;
}

function parseCSV(content) {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const [headerLine, ...dataLines] = lines;
  const headers = parseCSVLine(headerLine);
  return dataLines
    .filter(l => l.trim())
    .map(l => {
      const vals = parseCSVLine(l);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // 1. Verify columns exist
  console.log("Checking for lifetime_sold / legacy_skus columns...");
  const probe = await sb.from("heroes").select("lifetime_sold, legacy_skus").limit(1);
  if (probe.error) {
    if (probe.error.message?.includes("column") || probe.error.code === "42703") {
      console.error("✗ Columns not found. Run scripts/add-lifetime-sales-columns.sql in the Supabase SQL Editor first.");
    } else {
      console.error("✗ Supabase error:", probe.error.message);
    }
    process.exit(1);
  }
  console.log("  Columns confirmed.");

  // 2. Load CSV
  const csvPath = process.argv[2] || join(homedir(), "Downloads", "Hero_Lifetime_Sales_FINAL.csv");
  console.log(`\nLoading CSV: ${csvPath}`);
  const rows = parseCSV(readFileSync(csvPath, "utf8"));
  console.log(`  ${rows.length} rows parsed.`);

  // 3. Fetch all hero SKUs from Supabase
  console.log("\nFetching heroes from Supabase...");
  const { data: heroes, error: heroErr } = await sb
    .from("heroes")
    .select("id, lineitem_sku, name");
  if (heroErr) { console.error("✗ Hero fetch failed:", heroErr.message); process.exit(1); }
  console.log(`  ${heroes.length} heroes loaded.`);

  // Build sku → id map (lower-cased for case-insensitive matching)
  const skuMap = new Map();
  for (const h of heroes) {
    if (h.lineitem_sku) skuMap.set(h.lineitem_sku.toLowerCase(), h.id);
  }

  // 4. Build updates
  const updates = [];
  const skipped = [];

  for (const row of rows) {
    const sku = row["Base_SKU"]?.trim();
    const lifetimeSold = parseInt(row["Lifetime_Sold"], 10);
    const matchSources = (row["Match_Sources"] || "").trim();

    if (!sku || isNaN(lifetimeSold)) { skipped.push({ sku, reason: "missing SKU or invalid Lifetime_Sold" }); continue; }

    const id = skuMap.get(sku.toLowerCase());
    if (!id) { skipped.push({ sku, reason: "no hero found with lineitem_sku = " + sku }); continue; }

    const legacySkus = matchSources ? matchSources.split("|").map(s => s.trim()).filter(Boolean) : [];

    updates.push({ id, lifetime_sold: lifetimeSold, legacy_skus: legacySkus });
  }

  console.log(`\nMatched: ${updates.length} heroes`);
  if (skipped.length) {
    console.log(`Skipped: ${skipped.length} rows`);
    for (const s of skipped) console.log(`  ⚠ ${s.sku || "(blank)"}: ${s.reason}`);
  }

  if (updates.length === 0) {
    console.log("Nothing to update. Exiting.");
    process.exit(0);
  }

  // 5. Upsert in batches
  console.log("\nWriting to Supabase...");
  const batchSize = 50;
  let written = 0, failed = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const { error } = await sb.from("heroes").upsert(
      batch.map(u => ({ id: u.id, lifetime_sold: u.lifetime_sold, legacy_skus: u.legacy_skus, updated_at: new Date().toISOString() })),
      { onConflict: "id" }
    );
    if (error) {
      console.error(`  ✗ Batch ${i}–${i + batch.length} failed:`, error.message);
      failed += batch.length;
    } else {
      written += batch.length;
      process.stdout.write(`  ${written}/${updates.length} written...\r`);
    }
  }

  console.log(`\n\n✓ Done. Written: ${written}  Failed: ${failed}  Skipped: ${skipped.length}`);

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error("✗ Fatal:", e.message); process.exit(1); });

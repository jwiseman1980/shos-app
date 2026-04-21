#!/usr/bin/env node
/**
 * Upload all bracelet design SVGs from disk to Supabase Storage.
 *
 * Run from the shos-app project root:
 *   node scripts/upload-bracelet-designs-storage.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Scans: C:\dev\AI Projects\SHOS\Bracelet Design Files\{SKU}\
 * Uploads to: bracelet-designs/{SKU}/{filename}.svg
 * Validates: file must start with <svg or <?xml (rejects <!DOCTYPE html stubs)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "bracelet-designs";
const DESIGNS_DIR = path.join(
  "C:",
  "dev",
  "AI Projects",
  "SHOS",
  "Bracelet Design Files"
);

function isSvgValid(buffer) {
  const head = buffer.slice(0, 200).toString("utf8").trimStart();
  return head.startsWith("<svg") || head.startsWith("<?xml");
}

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);

  const exists = buckets.some((b) => b.name === BUCKET);
  if (exists) {
    console.log(`  Bucket "${BUCKET}" already exists.`);
    return;
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (createErr) throw new Error(`createBucket: ${createErr.message}`);
  console.log(`  Created bucket "${BUCKET}".`);
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  Steel Hearts — Bracelet SVG → Supabase Storage  ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  console.log("── Step 1: Ensure bucket ──");
  await ensureBucket();

  if (!fs.existsSync(DESIGNS_DIR)) {
    console.error(`\nDesigns directory not found: ${DESIGNS_DIR}`);
    process.exit(1);
  }

  const skus = fs
    .readdirSync(DESIGNS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`\n── Step 2: Upload SVGs (${skus.length} SKU folders) ──`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;
  const failures = [];

  for (const sku of skus) {
    const skuDir = path.join(DESIGNS_DIR, sku);
    const files = fs
      .readdirSync(skuDir)
      .filter((f) => f.toLowerCase().endsWith(".svg"));

    if (files.length === 0) {
      console.log(`  [${sku}] no SVG files — skip`);
      continue;
    }

    for (const file of files) {
      const filePath = path.join(skuDir, file);
      const buffer = fs.readFileSync(filePath);

      if (!isSvgValid(buffer)) {
        console.log(`  [${sku}/${file}] INVALID SVG content — skip`);
        skipped++;
        continue;
      }

      const storagePath = `${sku}/${file}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: "image/svg+xml",
          upsert: true,
        });

      if (error) {
        console.error(`  ✗ ${storagePath}: ${error.message}`);
        failures.push({ path: storagePath, reason: error.message });
        failed++;
      } else {
        console.log(`  ✓ ${storagePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
        uploaded++;
        totalBytes += buffer.length;
      }
    }
  }

  console.log("\n── Summary ──");
  console.log(`  Uploaded : ${uploaded}`);
  console.log(`  Skipped  : ${skipped} (invalid SVG content)`);
  console.log(`  Failed   : ${failed}`);
  console.log(`  Total    : ${(totalBytes / 1024).toFixed(1)} KB uploaded`);

  if (failures.length > 0) {
    console.log("\n── Failures ──");
    for (const f of failures) console.log(`  ${f.path}: ${f.reason}`);
  }

  console.log(`\nPublic URL base: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

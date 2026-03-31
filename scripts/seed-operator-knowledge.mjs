/**
 * seed-operator-knowledge.mjs
 *
 * One-time script: reads OPERATOR_CONTEXT.md from disk and upserts it into
 * the Supabase knowledge_files table as role="operator".
 *
 * Run once after setting STORAGE_BACKEND=supabase. After that, the Operator's
 * update_context_file tool keeps it current automatically.
 *
 * Usage:
 *   node scripts/seed-operator-knowledge.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env.local
const envPath = join(root, ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Read OPERATOR_CONTEXT.md
const contextPath = join(root, "OPERATOR_CONTEXT.md");
let content;
try {
  content = readFileSync(contextPath, "utf8");
} catch {
  console.error(`✗ OPERATOR_CONTEXT.md not found at: ${contextPath}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`Reading OPERATOR_CONTEXT.md — ${content.length} chars`);

  // Check if row already exists
  const { data: existing } = await supabase
    .from("knowledge_files")
    .select("id, role, last_updated")
    .eq("role", "operator")
    .single();

  const now = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("knowledge_files")
      .update({ content, last_updated: now })
      .eq("role", "operator");

    if (error) throw new Error(`Update failed: ${error.message}`);
    console.log(`✓ Updated existing operator knowledge file (id: ${existing.id})`);
    console.log(`  Was last updated: ${existing.last_updated || "unknown"}`);
  } else {
    const { data, error } = await supabase
      .from("knowledge_files")
      .insert({ role: "operator", content, last_updated: now, session_count: 1 })
      .select("id")
      .single();

    if (error) throw new Error(`Insert failed: ${error.message}`);
    console.log(`✓ Created operator knowledge file (id: ${data.id})`);
  }

  console.log(`✓ Done. The Operator will now start sessions with full Steel Hearts context.`);
  console.log(`  To update again: node scripts/seed-operator-knowledge.mjs`);
  console.log(`  Or: edit OPERATOR_CONTEXT.md and the Operator will sync it on next session close.`);
}

main().catch(e => { console.error("✗", e.message); process.exit(1); });

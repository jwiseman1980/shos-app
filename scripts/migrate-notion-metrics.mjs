/**
 * Migrate Notion Social Media Metrics Log + SOP Execution Log into Supabase.
 *
 * Usage: node scripts/migrate-notion-metrics.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Notion property extractors
function getText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
  if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
  return "";
}
function getSelect(prop) { return prop?.select?.name || null; }
function getNumber(prop) { return prop?.number ?? null; }
function getDate(prop) { return prop?.date?.start || null; }

async function fetchAll(dataSourceId) {
  const pages = [];
  let cursor = undefined;
  do {
    const res = await notion.dataSources.query({ data_source_id: dataSourceId, page_size: 100, start_cursor: cursor });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// -----------------------------------------------------------------------
// Social Media Metrics
// -----------------------------------------------------------------------
const METRICS_DS = "7beb3e2d-beca-406a-900b-45e86142281c";

async function migrateMetrics() {
  console.log("Fetching Social Media Metrics...");
  const pages = await fetchAll(METRICS_DS);
  console.log(`  ${pages.length} records`);

  let ok = 0, fail = 0;
  for (const page of pages) {
    const p = page.properties;
    const { error } = await sb.from("social_media_metrics").insert({
      week_ending: getText(p["Week Ending"]),
      page_reach: getNumber(p["Page Reach"]),
      impressions: getNumber(p["Impressions"]),
      net_follower_change: getNumber(p["Net Follower Change"]),
      total_engagement: getNumber(p["Total Engagement"]),
      engagement_rate: getNumber(p["Engagement Rate"]),
      page_visits: getNumber(p["Page Visits"]),
      top_post: getText(p["Top Post"]),
      top_post_engagement: getNumber(p["Top Post Engagement"]),
      bottom_post: getText(p["Bottom Post"]),
      period: getSelect(p["Period"]),
      status: getSelect(p["Status"]),
      logged_by: getText(p["Logged By"]),
      date_logged: getDate(p["Date Logged"]),
      notes: getText(p["Notes"]),
    });
    if (error) { console.error("  FAIL:", getText(p["Week Ending"]), error.message); fail++; }
    else ok++;
  }
  console.log(`  Done: ${ok} inserted, ${fail} failed`);
}

// -----------------------------------------------------------------------
// SOP Execution Log
// -----------------------------------------------------------------------
const SOP_LOG_DS = "9b652b9c-d31b-45df-b4b7-a7e95bc4d005";

async function migrateSopLog() {
  console.log("Fetching SOP Execution Log...");
  let pages;
  try {
    pages = await fetchAll(SOP_LOG_DS);
  } catch (e) {
    console.log("  SOP Execution Log not accessible:", e.message);
    return;
  }
  console.log(`  ${pages.length} records`);

  let ok = 0, fail = 0;
  for (const page of pages) {
    const p = page.properties;
    const { error } = await sb.from("sop_execution_log").insert({
      sop_id: getText(p["SOP"]) || getSelect(p["SOP"]) || "",
      sop_name: getText(p["Execution"]) || getText(p["SOP"]) || "",
      executed_by: getText(p["Executed By"]),
      execution_date: getDate(p["Date"]),
      status: getSelect(p["Status"]) || "complete",
      duration_minutes: getNumber(p["Duration"]),
      notes: getText(p["Notes"]),
    });
    if (error) { console.error("  FAIL:", error.message); fail++; }
    else ok++;
  }
  console.log(`  Done: ${ok} inserted, ${fail} failed`);
}

// -----------------------------------------------------------------------
async function run() {
  await migrateMetrics();
  await migrateSopLog();
  console.log("\nAll migrations complete.");
}

run().catch(e => { console.error("Fatal:", e.message); process.exit(1); });

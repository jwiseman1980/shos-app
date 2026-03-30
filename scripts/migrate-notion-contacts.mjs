/**
 * Migrate Notion Accounts & Contacts into Supabase contacts table.
 *
 * Prerequisites:
 *   1. Run add-contact-columns.sql in Supabase SQL Editor first
 *   2. Set env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NOTION_API_KEY
 *
 * Usage: node scripts/migrate-notion-contacts.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATA_SOURCE_ID = "442fd34f-283b-487b-addd-6ae75212f630"; // Accounts & Contacts data source

// Notion property extractors
function getText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
  if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
  return "";
}
function getSelect(prop) { return prop?.select?.name || null; }
function getMultiSelect(prop) { return (prop?.multi_select || []).map(s => s.name); }
function getCheckbox(prop) { return prop?.checkbox || false; }
function getEmail(prop) { return prop?.email || null; }
function getPhone(prop) { return prop?.phone_number || null; }
function getNumber(prop) { return prop?.number || 0; }
function getDate(prop) { return prop?.date?.start || null; }

async function fetchAllPages() {
  const pages = [];
  let cursor = undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      page_size: 100,
      start_cursor: cursor,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
    console.log(`  Fetched ${pages.length} records...`);
  } while (cursor);
  return pages;
}

function mapNotionToSupabase(page) {
  const p = page.properties;
  const name = getText(p["Name"]);
  const nameParts = name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  return {
    // Match existing contacts by email or SF IDs
    email: getEmail(p["Email"]),
    sf_id: getText(p["SF Contact ID"]) || null,
    sf_account_id: getText(p["SF Account ID"]) || null,

    // Core fields
    first_name: firstName,
    last_name: lastName,
    phone: getPhone(p["Phone"]),
    mailing_street: getText(p["Mailing Address"]),
    mailing_city: getText(p["City"]),
    mailing_state: getText(p["State"]),
    mailing_postal: getText(p["Zip"]),
    mailing_country: getText(p["Country"]) || null,
    notes: getText(p["Notes"]),

    // New fields from Notion
    relationship: getMultiSelect(p["Relationship"]),
    record_type: getSelect(p["Record Type"]),
    source: getSelect(p["Source"]),
    donor_stewardship_status: getSelect(p["Donor Stewardship Status"]),
    engagement_tier: getSelect(p["Engagement Tier"]),
    suppression_status: getMultiSelect(p["Suppression Status"]),
    suppressed: getCheckbox(p["Suppressed"]),
    family_anniversary_eligible: getCheckbox(p["Family Anniversary Eligible"]),
    family_message_eligible: getCheckbox(p["Family Message Delivery Eligible"]),
    purchaser_anniversary_eligible: getCheckbox(p["Purchaser Anniversary Eligible"]),
    newsletter_eligible: getCheckbox(p["Newsletter Eligible"]),
    newsletter_subscribed: getCheckbox(p["Newsletter Subscribed"]),
    org_status: getSelect(p["Org Status"]),
    next_action: getText(p["Next Action"]),
    next_action_date: getDate(p["Next Action Date"]),
    event_research_status: getSelect(p["Event Research Status"]),
    hero_gap_count: getNumber(p["Hero Gap Count"]),
    organization: getText(p["Organization"]) || null,

    // Metadata
    updated_at: new Date().toISOString(),
  };
}

async function run() {
  console.log("Fetching Notion Accounts & Contacts...");
  const pages = await fetchAllPages();
  console.log(`Total Notion records: ${pages.length}`);

  // Load existing Supabase contacts for matching
  const { data: existing } = await sb.from("contacts").select("id, email, sf_id");
  const emailMap = {};
  const sfIdMap = {};
  (existing || []).forEach(c => {
    if (c.email) emailMap[c.email.toLowerCase()] = c.id;
    if (c.sf_id) sfIdMap[c.sf_id] = c.id;
  });
  console.log(`Existing Supabase contacts: ${existing?.length || 0}`);

  let updated = 0, created = 0, skipped = 0, errors = 0;

  for (const page of pages) {
    const record = mapNotionToSupabase(page);

    // Try to match to existing contact by SF ID, then email
    const matchId = (record.sf_id && sfIdMap[record.sf_id])
      || (record.email && emailMap[record.email.toLowerCase()])
      || null;

    if (matchId) {
      // Update existing contact with Notion data
      const { id, ...updateData } = record;
      // Don't overwrite core fields if they're empty in Notion
      const cleanUpdate = {};
      for (const [key, val] of Object.entries(updateData)) {
        if (val === null || val === "" || (Array.isArray(val) && val.length === 0)) continue;
        cleanUpdate[key] = val;
      }
      // Always set the tag fields even if empty (that's meaningful)
      cleanUpdate.relationship = record.relationship;
      cleanUpdate.suppression_status = record.suppression_status;
      cleanUpdate.suppressed = record.suppressed;
      cleanUpdate.family_anniversary_eligible = record.family_anniversary_eligible;
      cleanUpdate.family_message_eligible = record.family_message_eligible;
      cleanUpdate.purchaser_anniversary_eligible = record.purchaser_anniversary_eligible;
      cleanUpdate.newsletter_eligible = record.newsletter_eligible;
      cleanUpdate.newsletter_subscribed = record.newsletter_subscribed;

      const { error } = await sb.from("contacts").update(cleanUpdate).eq("id", matchId);
      if (error) {
        console.error(`UPDATE FAIL: ${record.first_name} ${record.last_name} — ${error.message}`);
        errors++;
      } else {
        updated++;
      }
    } else if (record.email || record.first_name) {
      // Create new contact
      const { error } = await sb.from("contacts").insert(record);
      if (error) {
        if (error.message.includes("duplicate")) {
          skipped++;
        } else {
          console.error(`INSERT FAIL: ${record.first_name} ${record.last_name} — ${error.message}`);
          errors++;
        }
      } else {
        created++;
      }
    } else {
      skipped++;
    }
  }

  console.log("\n--- Migration Complete ---");
  console.log(`Updated: ${updated}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

run().catch(e => { console.error("Fatal:", e.message); process.exit(1); });

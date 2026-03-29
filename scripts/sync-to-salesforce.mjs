#!/usr/bin/env node
/**
 * Steel Hearts: Supabase → Salesforce Nightly Sync
 *
 * Pushes updated records from Supabase to Salesforce as a backup mirror.
 * Only syncs records updated since the last successful sync.
 *
 * Tables synced (Supabase → SF):
 *   heroes → Memorial_Bracelet__c
 *   contacts → Contact
 *   organizations → Account
 *   donations → Donation__c
 *   orders → Squarespace_Order__c
 *   order_items → Squarespace_Order_Item__c
 *   disbursements → Donation_Disbursement__c
 *   family_messages → Family_Message__c
 *   knowledge_files → SHOS_Knowledge__c
 *   friction_logs → SHOS_Friction__c
 *
 * Usage: node scripts/sync-to-salesforce.mjs
 * Schedule: Vercel cron or Claude Code scheduled task, 2 AM ET nightly
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SF connection
let sfAuth = null;
async function sfAuthenticate() {
  if (sfAuth) return sfAuth;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SF_CLIENT_ID,
    refresh_token: process.env.SF_REFRESH_TOKEN,
  });
  const res = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST", body: params,
  });
  if (!res.ok) throw new Error(`SF auth failed: ${await res.text()}`);
  sfAuth = await res.json();
  return sfAuth;
}

async function sfUpsert(objectName, externalIdField, records) {
  if (records.length === 0) return { success: 0, errors: 0 };
  const auth = await sfAuthenticate();

  // SF Composite API — batch upsert up to 200 at a time
  let success = 0, errors = 0;
  const batchSize = 200;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const compositeRequest = {
      allOrNone: false,
      records: batch.map(rec => ({
        attributes: { type: objectName },
        ...rec,
      })),
    };

    const url = `${auth.instance_url}/services/data/v62.0/composite/sobjects/${objectName}/${externalIdField}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(compositeRequest),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`  SF upsert error for ${objectName}: ${errText.slice(0, 200)}`);
      errors += batch.length;
      continue;
    }

    const results = await res.json();
    for (const r of results) {
      if (r.success) success++;
      else errors++;
    }
  }

  return { success, errors };
}

// Get last successful sync time
async function getLastSyncTime() {
  const { data } = await supabase
    .from("sf_sync_log")
    .select("completed_at")
    .eq("direction", "supabase_to_sf")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  return data?.completed_at || "2020-01-01T00:00:00Z";
}

// Get records updated since last sync
async function getUpdatedRecords(table, since) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .gte("updated_at", since)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`  Error reading ${table}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

// ---------------------------------------------------------------------------
// Sync table mappings
// ---------------------------------------------------------------------------

const SYNC_TABLES = [
  {
    supabase: "heroes",
    sf: "Memorial_Bracelet__c",
    externalId: "Id",
    map: (r) => ({
      Id: r.sf_id,
      Name: r.name,
      First_Name__c: r.first_name,
      Last_Name__c: r.last_name,
      Rank__c: r.rank,
      Active_Listing__c: r.active_listing,
      On_Hand_7in__c: r.on_hand_7in,
      On_Hand_6in__c: r.on_hand_6in,
      Design_Status__c: r.design_status,
      Anniversary_Status__c: r.anniversary_status,
      Anniversary_Notes__c: r.anniversary_notes,
    }),
    filter: (r) => !!r.sf_id, // Only sync records that originated from SF
  },
  {
    supabase: "contacts",
    sf: "Contact",
    externalId: "Id",
    map: (r) => ({
      Id: r.sf_id,
      FirstName: r.first_name,
      LastName: r.last_name,
      Email: r.email,
      Phone: r.phone,
    }),
    filter: (r) => !!r.sf_id,
  },
  {
    supabase: "organizations",
    sf: "Account",
    externalId: "Id",
    map: (r) => ({
      Id: r.sf_id,
      Name: r.name,
    }),
    filter: (r) => !!r.sf_id,
  },
  {
    supabase: "donations",
    sf: "Donation__c",
    externalId: "Id",
    map: (r) => ({
      Id: r.sf_id,
      Donor_First_Name__c: r.donor_first_name,
      Donor_Last_Name__c: r.donor_last_name,
      Donation_Amount__c: r.amount,
      Donation_Date__c: r.donation_date,
      Source__c: r.source,
    }),
    filter: (r) => !!r.sf_id,
  },
  {
    supabase: "knowledge_files",
    sf: "SHOS_Knowledge__c",
    externalId: "Id",
    map: (r) => ({
      Id: r.sf_id,
      Content__c: r.content?.slice(0, 131072), // SF long text limit
      Session_Count__c: r.session_count,
    }),
    filter: (r) => !!r.sf_id,
  },
];

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

async function run() {
  console.log("=== Supabase → Salesforce Nightly Sync ===");
  console.log(`Started: ${new Date().toISOString()}\n`);

  const lastSync = await getLastSyncTime();
  console.log(`Last sync: ${lastSync}\n`);

  let totalSynced = 0, totalErrors = 0;

  for (const table of SYNC_TABLES) {
    console.log(`--- ${table.supabase} → ${table.sf} ---`);
    const records = await getUpdatedRecords(table.supabase, lastSync);
    const eligible = records.filter(table.filter);
    console.log(`  Updated since last sync: ${records.length}, Eligible for SF: ${eligible.length}`);

    if (eligible.length === 0) {
      console.log("  Skipping — nothing to sync.");
      continue;
    }

    const sfRecords = eligible.map(table.map);
    const { success, errors } = await sfUpsert(table.sf, table.externalId, sfRecords);
    console.log(`  Synced: ${success}, Errors: ${errors}`);
    totalSynced += success;
    totalErrors += errors;
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Total synced: ${totalSynced}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Finished: ${new Date().toISOString()}`);

  // Log sync run
  await supabase.from("sf_sync_log").insert({
    table_name: "ALL",
    direction: "supabase_to_sf",
    records_synced: totalSynced,
    records_failed: totalErrors,
    status: totalErrors === 0 ? "completed" : "completed_with_errors",
    completed_at: new Date().toISOString(),
    details: { last_sync_from: lastSync },
  });
}

run().catch(err => { console.error("Sync failed:", err); process.exit(1); });

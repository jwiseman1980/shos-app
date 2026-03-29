#!/usr/bin/env node
/**
 * Fix FK resolution for order_items and disbursements.
 * Runs after the main migration to resolve SF IDs → Supabase UUIDs.
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

async function sfQuery(soql) {
  const auth = await sfAuthenticate();
  const url = `${auth.instance_url}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  });
  if (!res.ok) throw new Error(`SOQL failed: ${await res.text()}`);
  const data = await res.json();
  let records = data.records || [];
  let nextUrl = data.nextRecordsUrl;
  while (nextUrl) {
    const nextRes = await fetch(`${auth.instance_url}${nextUrl}`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });
    const nextData = await nextRes.json();
    records = records.concat(nextData.records || []);
    nextUrl = nextData.nextRecordsUrl;
  }
  return records;
}

// Build lookup maps: SF ID → Supabase UUID
async function buildLookup(table) {
  // Paginate to get ALL records (Supabase default limit is 1000)
  const map = {};
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id, sf_id")
      .not("sf_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Lookup ${table} failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      map[row.sf_id] = row.id;
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function run() {
  console.log("=== FK Resolution: order_items + disbursements ===\n");

  // Build lookup maps
  console.log("Building lookup maps...");
  const orderMap = await buildLookup("orders");
  const heroMap = await buildLookup("heroes");
  const orgMap = await buildLookup("organizations");
  console.log(`  Orders: ${Object.keys(orderMap).length} mapped`);
  console.log(`  Heroes: ${Object.keys(heroMap).length} mapped`);
  console.log(`  Orgs: ${Object.keys(orgMap).length} mapped`);

  // --- ORDER ITEMS ---
  console.log("\n--- Migrating: order_items (with FK resolution) ---");
  const items = await sfQuery(
    `SELECT Id, Lineitem_sku__c, Quantity__c, Unit_Price__c,
     Bracelet_Size__c, Production_Status__c,
     Squarespace_Order__c, Memorial_Bracelet__c
     FROM Squarespace_Order_Item__c`
  );
  console.log(`  SF records: ${items.length}`);

  const statusMap = {
    "Not Started": "not_started", "Design Needed": "design_needed",
    "Ready to Laser": "ready_to_laser", "In Production": "in_production",
    "Ready to Ship": "ready_to_ship", "Shipped": "shipped",
    "Delivered": "delivered", "Cancelled": "cancelled",
  };

  const itemRows = [];
  let skippedItems = 0;
  for (const r of items) {
    const orderId = orderMap[r.Squarespace_Order__c];
    if (!orderId) { skippedItems++; continue; } // Skip if order not found

    itemRows.push({
      sf_id: r.Id,
      order_id: orderId,
      hero_id: heroMap[r.Memorial_Bracelet__c] || null,
      lineitem_sku: r.Lineitem_sku__c,
      quantity: r.Quantity__c || 1,
      unit_price: r.Unit_Price__c,
      bracelet_size: r.Bracelet_Size__c,
      production_status: statusMap[r.Production_Status__c] || "not_started",
    });
  }
  console.log(`  Mapped: ${itemRows.length}, Skipped (no order): ${skippedItems}`);

  // Batch upsert
  let itemSuccess = 0;
  const chunkSize = 500;
  for (let i = 0; i < itemRows.length; i += chunkSize) {
    const chunk = itemRows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("order_items")
      .upsert(chunk, { onConflict: "sf_id", ignoreDuplicates: false });
    if (error) {
      console.error(`  ERROR chunk ${i}-${i + chunk.length}: ${error.message}`);
    } else {
      itemSuccess += chunk.length;
    }
  }
  console.log(`  Inserted/updated: ${itemSuccess}`);

  // --- DISBURSEMENTS ---
  console.log("\n--- Migrating: disbursements (with FK resolution) ---");

  // Need to get the org relationship from SF
  // Try Organization__c first, then Account__c
  let disbRecords;
  try {
    disbRecords = await sfQuery(
      `SELECT Id, Name, Amount__c, Disbursement_Date__c,
       Payment_Method__c, Confirmation_Number__c, Gmail_Message_Id__c,
       Organization__c, CreatedDate
       FROM Donation_Disbursement__c`
    );
  } catch (e) {
    // Try Account__c if Organization__c doesn't exist
    console.log("  Organization__c not found, trying Account__c...");
    try {
      disbRecords = await sfQuery(
        `SELECT Id, Name, Amount__c, Disbursement_Date__c,
         Payment_Method__c, Confirmation_Number__c, Gmail_Message_Id__c,
         Account__c, CreatedDate
         FROM Donation_Disbursement__c`
      );
      // Remap Account__c to Organization__c for consistency
      disbRecords = disbRecords.map(r => ({ ...r, Organization__c: r.Account__c }));
    } catch (e2) {
      console.error("  Failed to query disbursements:", e2.message);
      disbRecords = [];
    }
  }
  console.log(`  SF records: ${disbRecords.length}`);

  const methodMap = {
    "ACH": "ach", "Check": "check", "Wire": "wire",
    "PayPal": "paypal", "Venmo": "venmo", "Zelle": "zelle",
  };

  const disbRows = [];
  let skippedDisb = 0;
  for (const r of disbRecords) {
    const orgId = orgMap[r.Organization__c];
    if (!orgId) { skippedDisb++; continue; }

    disbRows.push({
      sf_id: r.Id,
      organization_id: orgId,
      amount: r.Amount__c || 0,
      disbursement_date: r.Disbursement_Date__c || r.CreatedDate?.split("T")[0],
      payment_method: methodMap[r.Payment_Method__c] || null,
      confirmation_number: r.Confirmation_Number__c,
      gmail_message_id: r.Gmail_Message_Id__c,
    });
  }
  console.log(`  Mapped: ${disbRows.length}, Skipped (no org): ${skippedDisb}`);

  if (disbRows.length > 0) {
    const { error } = await supabase
      .from("disbursements")
      .upsert(disbRows, { onConflict: "sf_id", ignoreDuplicates: false });
    if (error) {
      console.error(`  ERROR: ${error.message}`);
    } else {
      console.log(`  Inserted/updated: ${disbRows.length}`);
    }
  }

  // --- HERO FK RESOLUTION (contacts + orgs on heroes) ---
  console.log("\n--- Resolving hero FKs (family_contact_id, organization_id) ---");
  const heroRecords = await sfQuery(
    `SELECT Id, Associated_Family_Contact__c, Associated_Organization__c
     FROM Memorial_Bracelet__c`
  );

  const contactMap = await buildLookup("contacts");
  let heroUpdated = 0;
  for (const r of heroRecords) {
    const familyId = contactMap[r.Associated_Family_Contact__c] || null;
    const orgId = orgMap[r.Associated_Organization__c] || null;
    if (!familyId && !orgId) continue;

    const heroUuid = heroMap[r.Id];
    if (!heroUuid) continue;

    const updates = {};
    if (familyId) updates.family_contact_id = familyId;
    if (orgId) updates.organization_id = orgId;

    const { error } = await supabase.from("heroes").update(updates).eq("id", heroUuid);
    if (!error) heroUpdated++;
  }
  console.log(`  Heroes updated with FKs: ${heroUpdated}`);

  // --- SUMMARY ---
  console.log("\n=== FK Resolution Complete ===");
  console.log(`Order items: ${itemSuccess} migrated`);
  console.log(`Disbursements: ${disbRows.length} migrated`);
  console.log(`Hero FKs: ${heroUpdated} updated`);

  // Log to sync table
  await supabase.from("sf_sync_log").insert({
    table_name: "FK_RESOLUTION",
    direction: "sf_to_supabase",
    records_synced: itemSuccess + disbRows.length + heroUpdated,
    status: "completed",
    completed_at: new Date().toISOString(),
    details: { order_items: itemSuccess, disbursements: disbRows.length, hero_fks: heroUpdated },
  });
}

run().catch(err => { console.error("Failed:", err); process.exit(1); });

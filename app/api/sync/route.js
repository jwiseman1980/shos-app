/**
 * Supabase → Salesforce Nightly Sync API Route
 *
 * Called by Vercel cron at 2 AM ET or manually via API key.
 * Syncs updated records from Supabase to Salesforce as a backup mirror.
 */

import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for sync

// SF auth
async function sfAuth() {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SF_CLIENT_ID,
    refresh_token: process.env.SF_REFRESH_TOKEN,
  });
  const res = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST", body: params,
  });
  if (!res.ok) throw new Error("SF auth failed");
  return res.json();
}

async function sfUpsertBatch(auth, objectName, records) {
  if (records.length === 0) return { success: 0, errors: 0 };

  let success = 0, errors = 0;
  const batchSize = 200;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const url = `${auth.instance_url}/services/data/v62.0/composite/sobjects/${objectName}/Id`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        allOrNone: false,
        records: batch.map(r => ({ attributes: { type: objectName }, ...r })),
      }),
    });

    if (!res.ok) { errors += batch.length; continue; }
    const results = await res.json();
    for (const r of results) { r.success ? success++ : errors++; }
  }
  return { success, errors };
}

export async function GET(request) {
  // Auth: Vercel CRON_SECRET header or SHOS_API_KEY
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = new URL(request.url).searchParams.get("key") || request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;

  if (!isVercelCron && !isApiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();

  // Get last sync time
  const { data: lastSyncData } = await sb
    .from("sf_sync_log")
    .select("completed_at")
    .eq("direction", "supabase_to_sf")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastSyncData?.completed_at || "2020-01-01T00:00:00Z";

  let auth;
  try { auth = await sfAuth(); } catch (e) {
    return Response.json({ error: "SF auth failed", message: e.message }, { status: 500 });
  }

  const results = {};
  let totalSynced = 0, totalErrors = 0;

  // Sync each table
  const tables = [
    { sb: "heroes", sf: "Memorial_Bracelet__c", map: r => r.sf_id ? { Id: r.sf_id, Active_Listing__c: r.active_listing, On_Hand_7in__c: r.on_hand_7in, On_Hand_6in__c: r.on_hand_6in, Anniversary_Status__c: r.anniversary_status } : null },
    { sb: "contacts", sf: "Contact", map: r => r.sf_id ? { Id: r.sf_id, FirstName: r.first_name, LastName: r.last_name, Email: r.email, Phone: r.phone } : null },
    { sb: "organizations", sf: "Account", map: r => r.sf_id ? { Id: r.sf_id, Name: r.name } : null },
    { sb: "donations", sf: "Donation__c", map: r => r.sf_id ? { Id: r.sf_id, Donation_Amount__c: r.amount, Source__c: r.source } : null },
    { sb: "knowledge_files", sf: "SHOS_Knowledge__c", map: r => r.sf_id ? { Id: r.sf_id, Content__c: r.content?.slice(0, 131072), Session_Count__c: r.session_count } : null },
    // Financial tables (added for full backup coverage)
    { sb: "disbursements", sf: "Disbursement__c", map: r => r.sf_id ? { Id: r.sf_id, Amount__c: r.amount, Status__c: r.status, Hero_Name__c: r.hero_name, Disbursement_Date__c: r.disbursement_date } : null },
    { sb: "expenses", sf: "Expense__c", map: r => r.sf_id ? { Id: r.sf_id, Amount__c: r.amount, Category__c: r.category, Description__c: r.description, Expense_Date__c: r.expense_date } : null },
    { sb: "obligations", sf: "Obligation__c", map: r => r.sf_id ? { Id: r.sf_id, Amount__c: r.amount, Status__c: r.status, Description__c: r.description, Due_Date__c: r.due_date } : null },
    { sb: "order_items", sf: "Order_Item__c", map: r => r.sf_id ? { Id: r.sf_id, SKU__c: r.sku, Quantity__c: r.quantity, Status__c: r.status, Hero_Name__c: r.hero_name } : null },
    { sb: "engagements", sf: "Engagement__c", map: r => r.sf_id ? { Id: r.sf_id, Type__c: r.type, Subject__c: r.subject, Engagement_Date__c: r.engagement_date } : null },
  ];

  for (const t of tables) {
    const { data: records } = await sb
      .from(t.sb)
      .select("*")
      .gte("updated_at", since);

    const sfRecords = (records || []).map(t.map).filter(Boolean);
    if (sfRecords.length === 0) {
      results[t.sb] = { updated: 0, synced: 0 };
      continue;
    }

    const { success, errors } = await sfUpsertBatch(auth, t.sf, sfRecords);
    results[t.sb] = { updated: records.length, synced: success, errors };
    totalSynced += success;
    totalErrors += errors;
  }

  // Log
  await sb.from("sf_sync_log").insert({
    table_name: "ALL",
    direction: "supabase_to_sf",
    records_synced: totalSynced,
    records_failed: totalErrors,
    status: totalErrors === 0 ? "completed" : "completed_with_errors",
    completed_at: new Date().toISOString(),
    details: { since, results },
  });

  return Response.json({
    ok: true,
    since,
    totalSynced,
    totalErrors,
    tables: results,
  });
}

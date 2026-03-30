/**
 * Salesforce → Supabase Order Sync
 *
 * Polls SF for Squarespace orders newer than the latest in Supabase
 * and inserts them. Runs hourly via Vercel cron.
 *
 * This bridges the gap: Squarespace → SF → (this cron) → Supabase
 * until the new website (steel-hearts-site) replaces Squarespace entirely.
 */

import { getServerClient } from "@/lib/supabase";
import { sfQuery } from "@/lib/salesforce";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toBaseSku(sku) {
  if (!sku) return "";
  return sku
    .replace(/-[67]D$/i, "")
    .replace(/-[67]$/i, "")
    .replace(/-D$/i, "");
}

function sizeFromSku(sku) {
  if (!sku) return "Regular-7in";
  if (/-6D?$/i.test(sku)) return "Small-6in";
  return "Regular-7in";
}

export async function GET(request) {
  // Auth: Vercel CRON_SECRET or SHOS_API_KEY
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key =
    new URL(request.url).searchParams.get("key") ||
    request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();

  // Find the highest numeric order number in Supabase by paginating
  let latestNum = 0;
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await sb
      .from("orders")
      .select("order_number")
      .not("order_number", "like", "MIGRATED%")
      .range(offset, offset + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const n = parseInt(r.order_number);
      if (!isNaN(n) && n > latestNum) latestNum = n;
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  if (!latestNum || latestNum < 1000) {
    return NextResponse.json({
      ok: false,
      error: "Could not determine latest order number",
    });
  }

  // Query SF for orders created after the latest order's date
  // We use CreatedDate instead of Name comparison to avoid string sort issues
  // Fetch orders from the last 48 hours as a safety window — dedup handles overlap
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const soql = `SELECT Name, Order_Date__c, Order_Type__c, Billing_Name__c, Billing_Email__c, Shipping_Name__c, Shipping_Address1__c, Shipping_City__c, Shipping_State__c, Shipping_Postal__c, Shipping_Country__c, Order_Total__c, (SELECT Lineitem_sku__c, Quantity__c, Unit_Price__c, Production_Status__c FROM Squarespace_Order_Items__r) FROM Squarespace_Order__c WHERE CreatedDate >= ${since} ORDER BY CreatedDate ASC LIMIT 200`;

  let sfOrders;
  try {
    sfOrders = await sfQuery(soql);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "SF query failed", message: e.message },
      { status: 500 }
    );
  }

  if (!sfOrders || sfOrders.length === 0) {
    return NextResponse.json({
      ok: true,
      synced: 0,
      latestOrderNumber: latestNum,
      message: "No new orders",
    });
  }

  // Build hero lookup cache
  const allSkus = new Set();
  for (const o of sfOrders) {
    for (const item of o.Squarespace_Order_Items__r?.records || []) {
      const base = toBaseSku(item.Lineitem_sku__c);
      if (base) allSkus.add(base);
    }
  }

  const heroCache = {};
  for (const sku of allSkus) {
    const { data } = await sb
      .from("heroes")
      .select("id")
      .ilike("lineitem_sku", sku)
      .limit(1)
      .single();
    heroCache[sku] = data?.id || null;
  }

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const o of sfOrders) {
    // Dedup
    const { data: existing } = await sb
      .from("orders")
      .select("id")
      .eq("order_number", o.Name)
      .limit(1)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({
        order_number: o.Name,
        order_date: o.Order_Date__c?.slice(0, 10),
        order_type: "paid",
        billing_name: o.Billing_Name__c,
        billing_email: o.Billing_Email__c,
        shipping_name: o.Shipping_Name__c,
        shipping_address1: o.Shipping_Address1__c,
        shipping_city: o.Shipping_City__c,
        shipping_state: o.Shipping_State__c,
        shipping_postal: o.Shipping_Postal__c,
        shipping_country: o.Shipping_Country__c || "US",
        source: "squarespace",
      })
      .select("id")
      .single();

    if (oErr) {
      console.error("Order sync error:", o.Name, oErr.message);
      errors++;
      continue;
    }

    const items = o.Squarespace_Order_Items__r?.records || [];
    for (const item of items) {
      const sku = item.Lineitem_sku__c || "";
      const base = toBaseSku(sku);
      const heroId = heroCache[base] || null;

      await sb.from("order_items").insert({
        order_id: order.id,
        lineitem_sku: sku,
        quantity: item.Quantity__c || 1,
        unit_price: item.Unit_Price__c || 0,
        bracelet_size: sizeFromSku(sku),
        hero_id: heroId,
        production_status: "not_started",
      });
    }

    synced++;
  }

  // Post to Slack
  const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
  if (slackWebhook && synced > 0) {
    try {
      await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Order sync: ${synced} new order(s) from Squarespace via SF`,
        }),
      });
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    synced,
    skipped,
    errors,
    latestOrderNumber: latestNum,
    sfOrdersFound: sfOrders.length,
  });
}

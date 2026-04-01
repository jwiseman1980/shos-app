/**
 * Manual order sync trigger — session-authenticated.
 * Calls the same SF→Supabase logic as the hourly cron.
 */
import { isAuthenticated } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";
import { sfQuery } from "@/lib/salesforce";
import { triageNeedsDecision } from "@/lib/data/orders";
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

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();

  // Find the highest numeric order number in Supabase
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
    return NextResponse.json({ ok: false, error: "Could not determine latest order number" });
  }

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const soql = `SELECT Name, Order_Date__c, Order_Type__c, Billing_Name__c, Billing_Email__c, Shipping_Name__c, Shipping_Address1__c, Shipping_City__c, Shipping_State__c, Shipping_Postal__c, Shipping_Country__c, Order_Total__c, (SELECT Lineitem_sku__c, Quantity__c, Unit_Price__c, Production_Status__c FROM Squarespace_Order_Items__r) FROM Squarespace_Order__c WHERE CreatedDate >= ${since} ORDER BY CreatedDate ASC LIMIT 200`;

  let sfOrders;
  try {
    sfOrders = await sfQuery(soql);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Salesforce query failed", message: e.message },
      { status: 500 }
    );
  }

  if (!sfOrders || sfOrders.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: "No new orders in Salesforce" });
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
  const syncedOrders = [];

  for (const o of sfOrders) {
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

    syncedOrders.push(`#${o.Name} — ${o.Billing_Name__c}`);
    synced++;
  }

  // Auto-triage any not_started items so they advance immediately
  let triageResult = null;
  if (synced > 0) {
    try {
      triageResult = await triageNeedsDecision();
    } catch (e) {
      console.error("Post-sync triage failed:", e.message);
    }
  }

  return NextResponse.json({
    ok: true,
    synced,
    skipped,
    errors,
    syncedOrders,
    sfOrdersFound: sfOrders.length,
    triage: triageResult
      ? { advanced: triageResult.advanced, fromStock: triageResult.fromStock, needsDesign: triageResult.needsDesign }
      : null,
  });
}

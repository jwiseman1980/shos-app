// One-off: list all outstanding orders from ShipStation + Supabase.
// Combines awaiting_shipment + on_hold from ShipStation with any Supabase
// order that has at least one item not yet shipped/cancelled/delivered.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually so we don't need a node_modules install
try {
  const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch (e) {
  console.warn("Could not load .env.local:", e.message);
}

const SS_KEY = process.env.SHIPSTATION_API_KEY;
const SS_SECRET = process.env.SHIPSTATION_API_SECRET;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SS_KEY || !SS_SECRET) throw new Error("Missing SHIPSTATION_API_KEY/SECRET");
if (!SB_URL || !SB_SERVICE) throw new Error("Missing Supabase env vars");

const ssAuth = "Basic " + Buffer.from(`${SS_KEY}:${SS_SECRET}`).toString("base64");

async function ssList(orderStatus) {
  const url = `https://ssapi.shipstation.com/orders?orderStatus=${orderStatus}&sortBy=OrderDate&sortDir=DESC&pageSize=200`;
  const res = await fetch(url, { headers: { Authorization: ssAuth } });
  if (!res.ok) throw new Error(`ShipStation ${orderStatus}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.orders || [];
}

async function main() {
  console.log("Fetching ShipStation awaiting_shipment + on_hold...");
  const [awaiting, onHold] = await Promise.all([
    ssList("awaiting_shipment"),
    ssList("on_hold"),
  ]);

  console.log("Fetching Supabase open order_items...");
  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: openItems, error } = await sb
    .from("order_items")
    .select(`
      id, lineitem_sku, quantity, bracelet_size, production_status, created_at,
      order:orders!order_id(
        id, order_number, order_date, order_type, source,
        billing_name, shipping_name, billing_email
      ),
      hero:heroes!hero_id(name)
    `)
    .not("production_status", "in", '("shipped","cancelled","delivered")')
    .limit(500);
  if (error) throw error;

  // Group Supabase items by order
  const sbByOrder = new Map();
  for (const item of openItems || []) {
    const o = item.order;
    if (!o) continue;
    const key = o.order_number || `_id:${o.id}`;
    if (!sbByOrder.has(key)) {
      sbByOrder.set(key, {
        orderNumber: o.order_number,
        orderDate: o.order_date,
        customer: o.shipping_name || o.billing_name,
        email: o.billing_email,
        orderType: o.order_type,
        source: o.source || "manual",
        items: [],
      });
    }
    sbByOrder.get(key).items.push({
      sku: item.lineitem_sku,
      hero: item.hero?.name,
      qty: item.quantity || 1,
      size: item.bracelet_size,
      status: item.production_status,
    });
  }

  console.log("\n=== SHIPSTATION: AWAITING_SHIPMENT (" + awaiting.length + ") ===");
  for (const o of awaiting) {
    const ageDays = Math.floor((Date.now() - new Date(o.orderDate).getTime()) / 86400000);
    console.log(
      `  #${o.orderNumber} | ${o.shipTo?.name || "—"} | ${ageDays}d old | ` +
      o.items.map(i => `${i.sku || i.name}x${i.quantity}`).join(", ")
    );
  }

  console.log("\n=== SHIPSTATION: ON_HOLD (" + onHold.length + ") ===");
  for (const o of onHold) {
    const ageDays = Math.floor((Date.now() - new Date(o.orderDate).getTime()) / 86400000);
    console.log(
      `  #${o.orderNumber} | ${o.shipTo?.name || "—"} | ${ageDays}d old | ` +
      o.items.map(i => `${i.sku || i.name}x${i.quantity}`).join(", ")
    );
  }

  console.log("\n=== SUPABASE: OPEN ORDERS (" + sbByOrder.size + ") ===");
  // Sort oldest first
  const sbList = [...sbByOrder.values()].sort(
    (a, b) => new Date(a.orderDate || 0) - new Date(b.orderDate || 0)
  );
  for (const o of sbList) {
    const ageDays = o.orderDate
      ? Math.floor((Date.now() - new Date(o.orderDate).getTime()) / 86400000)
      : "?";
    console.log(
      `  #${o.orderNumber || "—"} | ${o.customer || "—"} | ${ageDays}d | ${o.orderType} (${o.source})`
    );
    for (const i of o.items) {
      console.log(`     - ${i.hero || i.sku} (${i.sku || "—"}) x${i.qty} ${i.size ? `[${i.size}"]` : ""} → ${i.status}`);
    }
  }

  // Summary
  const ssNumbers = new Set([...awaiting, ...onHold].map(o => o.orderNumber).filter(Boolean));
  const sbOnly = sbList.filter(o => !ssNumbers.has(o.orderNumber));
  console.log("\n=== SUMMARY ===");
  console.log(`  ShipStation awaiting_shipment:   ${awaiting.length}`);
  console.log(`  ShipStation on_hold:             ${onHold.length}`);
  console.log(`  Supabase open orders:            ${sbByOrder.size}`);
  console.log(`  Supabase-only (no ShipStation):  ${sbOnly.length}`);
  console.log(`  Total unique outstanding:        ${ssNumbers.size + sbOnly.length}`);

  // Look for #16263
  const found16263 = awaiting.find(o => o.orderNumber === "16263") ||
                     onHold.find(o => o.orderNumber === "16263");
  console.log(`\n  Order #16263 status: ${found16263 ? "FOUND in " + found16263.orderStatus : "NOT in ShipStation"}`);
}

main().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});

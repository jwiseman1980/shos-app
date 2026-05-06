#!/usr/bin/env node
/**
 * sync-shipped-from-shipstation.mjs
 *
 * Reconcile Supabase order_items with ShipStation. Any order that ShipStation
 * reports as shipped should have all of its line items marked
 * production_status = 'shipped' in Supabase.
 *
 * Match key: orders.order_number  ↔  ShipStation orderNumber.
 *
 * Schema gap: the user's spec mentions a shipped_date column, but the live
 * schema has none on either `orders` or `order_items`. Production_status is
 * the canonical shipped flag today. ShipStation shipDate is reported per
 * order so the data is collected and printed for the largest backlog
 * orders, but nothing is written to a shipped_date column. Add the column
 * separately if it becomes useful.
 *
 * Usage:
 *   node scripts/one-off/sync-shipped-from-shipstation.mjs           # dry run
 *   node scripts/one-off/sync-shipped-from-shipstation.mjs --apply   # write
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const ENV_PATH = "C:/dev/AI Projects/SHOS/shos-app/.env.local";

for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SS_KEY = process.env.SHIPSTATION_API_KEY;
const SS_SECRET = process.env.SHIPSTATION_API_SECRET;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SS_KEY || !SS_SECRET) throw new Error("SHIPSTATION_API_KEY / _SECRET missing");
if (!SB_URL || !SB_KEY) throw new Error("Supabase URL / service role missing");

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const ssAuth = "Basic " + Buffer.from(`${SS_KEY}:${SS_SECRET}`).toString("base64");

async function ssListShipped(page) {
  const url = new URL("https://ssapi.shipstation.com/orders");
  url.searchParams.set("orderStatus", "shipped");
  url.searchParams.set("sortBy", "ModifyDate");
  url.searchParams.set("sortDir", "DESC");
  url.searchParams.set("pageSize", "500");
  url.searchParams.set("page", String(page));

  // ShipStation rate-limits at 40 req / minute. Retry on 429.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { Authorization: ssAuth } });
    if (res.status === 429) {
      const wait = Number(res.headers.get("X-Rate-Limit-Reset") || "10") * 1000 + 250;
      console.warn(`  rate-limited, sleeping ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`ShipStation ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error("ShipStation rate limit retries exhausted");
}

async function fetchAllShipped() {
  const all = [];
  let page = 1;
  let totalPages = null;
  while (true) {
    const j = await ssListShipped(page);
    if (totalPages == null) totalPages = j.pages || 1;
    const orders = j.orders || [];
    all.push(...orders);
    process.stdout.write(`\r  fetched page ${page}/${totalPages} (${all.length} orders)`);
    if (page >= totalPages || orders.length === 0) break;
    page++;
  }
  process.stdout.write("\n");
  return all;
}

async function fetchUnshippedItemsByOrderNumber() {
  // Pull every unshipped item with its parent order_number. Page through to
  // avoid the 1000-row default cap.
  const out = new Map(); // order_number -> [{ id, order_id }, ...]
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("order_items")
      .select("id, order_id, production_status, order:orders!order_id(order_number)")
      .neq("production_status", "shipped")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const num = row.order?.order_number;
      if (!num) continue;
      if (!out.has(num)) out.set(num, []);
      out.get(num).push({ id: row.id, order_id: row.order_id, status: row.production_status });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

(async () => {
  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY-RUN (no writes)"}`);

  console.log("Fetching shipped orders from ShipStation...");
  const shipped = await fetchAllShipped();
  console.log(`  total shipped in ShipStation: ${shipped.length}`);

  // Build lookup: orderNumber -> { shipDate, orderId }
  const ssByNumber = new Map();
  for (const o of shipped) {
    if (!o.orderNumber) continue;
    const prev = ssByNumber.get(o.orderNumber);
    // Keep the most recent shipDate if multiple ShipStation rows share a number.
    if (!prev || (o.shipDate && (!prev.shipDate || o.shipDate > prev.shipDate))) {
      ssByNumber.set(o.orderNumber, { shipDate: o.shipDate, orderId: o.orderId });
    }
  }

  console.log("Fetching unshipped order_items from Supabase...");
  const sbByNumber = await fetchUnshippedItemsByOrderNumber();
  const sbOrderCount = sbByNumber.size;
  const sbItemCount = [...sbByNumber.values()].reduce((s, a) => s + a.length, 0);
  console.log(`  ${sbItemCount} unshipped items across ${sbOrderCount} orders in Supabase`);

  // Intersection
  const matches = [];
  let unmatchedSb = 0;
  for (const [num, items] of sbByNumber.entries()) {
    const ss = ssByNumber.get(num);
    if (ss) matches.push({ orderNumber: num, items, shipDate: ss.shipDate });
    else unmatchedSb++;
  }
  console.log(
    `\nMatch summary: ${matches.length} orders / ${matches.reduce((s, m) => s + m.items.length, 0)} items would be flipped to shipped.`
  );
  console.log(`  ${unmatchedSb} Supabase orders had no matching shipped order in ShipStation (still in production or sync gap).`);

  if (matches.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log("\nFirst 10 matches:");
  for (const m of matches.slice(0, 10)) {
    console.log(`  #${m.orderNumber}  items=${m.items.length}  shipDate=${m.shipDate || "(null)"}`);
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write.");
    return;
  }

  console.log("\nApplying...");
  let updated = 0;
  let failed = 0;
  for (const m of matches) {
    const ids = m.items.map((i) => i.id);
    const { error } = await sb
      .from("order_items")
      .update({ production_status: "shipped" })
      .in("id", ids);
    if (error) {
      failed++;
      console.error(`  #${m.orderNumber} update failed:`, error.message);
    } else {
      updated += ids.length;
    }
  }
  console.log(`\nDone. Items flipped to shipped: ${updated}. Failed orders: ${failed}.`);
  console.log(
    `(Note: shipped_date not written — no such column on orders/order_items today. ` +
    `If you want it persisted, add the column and rerun this script with a stash of the shipDate map.)`
  );
})().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

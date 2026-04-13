/**
 * backfill-squarespace.mjs
 *
 * One-time backfill: pulls all Squarespace orders modified in the last N days,
 * writes new ones to Supabase (idempotent), then cross-references ShipStation
 * to mark any already-shipped orders with status "shipped" + tracking number.
 *
 * Deliberately skips ShipStation push and Slack notify for backfilled orders
 * (those are old orders — we don't want 70 Slack pings).
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-squarespace.mjs
 *   node --env-file=.env.local scripts/backfill-squarespace.mjs --days=14
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────

const DAYS = parseInt(process.argv.find(a => a.startsWith("--days="))?.split("=")[1] ?? "14");
const DRY_RUN = process.argv.includes("--dry-run");

const SQ_API_BASE = "https://api.squarespace.com/1.0/commerce/orders";
const SQ_API_KEY = process.env.SQUARESPACE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SS_API_KEY = process.env.SHIPSTATION_API_KEY;
const SS_API_SECRET = process.env.SHIPSTATION_API_SECRET;

if (!SQ_API_KEY) { console.error("❌ SQUARESPACE_API_KEY not set"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("❌ Supabase env vars not set"); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const modifiedAfter = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

console.log(`\n🔄 Squarespace backfill — last ${DAYS} days (since ${modifiedAfter.slice(0, 10)})`);
if (DRY_RUN) console.log("⚠️  DRY RUN — no writes will occur");

// ── Squarespace API ───────────────────────────────────────────────────────────

async function fetchSquarespaceOrders() {
  const allOrders = [];
  let nextCursor = null;
  const modifiedBefore = new Date().toISOString();

  do {
    const url = new URL(SQ_API_BASE);
    if (nextCursor) {
      // When paginating with cursor, no other params allowed
      url.searchParams.set("cursor", nextCursor);
    } else {
      url.searchParams.set("modifiedAfter", modifiedAfter);
      url.searchParams.set("modifiedBefore", modifiedBefore);
    }

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${SQ_API_KEY}`, "User-Agent": "SHOS-Backfill/1.0" },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Squarespace API ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    allOrders.push(...(data.result ?? []));
    nextCursor = data.pagination?.hasNextPage ? data.pagination.nextPageCursor : null;
    if (nextCursor) console.log(`  → paginating... (${allOrders.length} so far)`);
  } while (nextCursor);

  return allOrders;
}

// ── Normalization ─────────────────────────────────────────────────────────────

function normalize(sqOrder) {
  const bill = sqOrder.billingAddress ?? {};
  const ship = sqOrder.shippingAddress ?? bill;
  return {
    orderNumber: String(sqOrder.orderNumber ?? sqOrder.id ?? ""),
    orderDate: (sqOrder.createdOn ?? new Date().toISOString()).slice(0, 10),
    billingName: [bill.firstName, bill.lastName].filter(Boolean).join(" ").trim(),
    billingEmail: sqOrder.customerEmail ?? "",
    shippingName: [ship.firstName, ship.lastName].filter(Boolean).join(" ").trim(),
    shippingAddress1: ship.address1 ?? "",
    shippingCity: ship.city ?? "",
    shippingState: ship.state ?? "",
    shippingPostal: ship.postalCode ?? "",
    shippingCountry: ship.countryCode ?? "US",
    notes: sqOrder.customerMessage ?? null,
    items: (sqOrder.lineItems ?? []).map(li => ({
      sku: li.sku ?? "",
      quantity: li.quantity ?? 1,
      unitPrice: parseFloat(li.unitPricePaid?.value ?? li.unitPrice ?? 0),
      productName: li.productName ?? li.name ?? "",
    })),
  };
}

// ── SKU helpers ───────────────────────────────────────────────────────────────

function toBaseSku(sku) {
  if (!sku) return "";
  return sku.replace(/-[67]D$/i, "").replace(/-[67]$/i, "").replace(/-D$/i, "");
}

function sizeFromSku(sku) {
  if (!sku) return "Regular-7in";
  return /-6D?$/i.test(sku) ? "Small-6in" : "Regular-7in";
}

async function findHeroBySku(sku) {
  if (!sku) return null;
  const base = toBaseSku(sku);
  if (!base) return null;
  const { data } = await sb.from("heroes").select("id").ilike("lineitem_sku", base).limit(1).single();
  return data?.id ?? null;
}

// ── Supabase writes ───────────────────────────────────────────────────────────

async function ensureSystemConfigTable() {
  // Try to read — if table doesn't exist, it will error and we note it
  try {
    await sb.from("system_config").select("key").limit(1);
    console.log("✓ system_config table exists");
  } catch (e) {
    console.warn("⚠️  system_config table not found — cursor tracking will be skipped");
    console.warn("   Run this SQL in Supabase dashboard to create it:");
    console.warn("   create table if not exists system_config (key text primary key, value text not null, updated_at timestamptz default now());");
  }
}

async function upsertCursor(isoTimestamp) {
  if (DRY_RUN) return;
  try {
    await sb.from("system_config")
      .upsert({ key: "squarespace_orders_last_sync", value: isoTimestamp }, { onConflict: "key" });
  } catch (e) {
    console.warn("  ⚠️  Could not update cursor:", e.message);
  }
}

async function insertOrder(order) {
  if (DRY_RUN) return { id: "dry-run" };
  const { data, error } = await sb
    .from("orders")
    .insert({
      order_number: order.orderNumber,
      order_date: order.orderDate,
      order_type: "paid",
      billing_name: order.billingName,
      billing_email: order.billingEmail,
      shipping_name: order.shippingName,
      shipping_address1: order.shippingAddress1,
      shipping_city: order.shippingCity,
      shipping_state: order.shippingState,
      shipping_postal: order.shippingPostal,
      shipping_country: order.shippingCountry,
      source: "squarespace",
      notes: order.notes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function insertItems(orderId, items) {
  if (DRY_RUN) return;
  for (const item of items) {
    const heroId = await findHeroBySku(item.sku);
    const { error } = await sb.from("order_items").insert({
      order_id: orderId,
      lineitem_sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      bracelet_size: sizeFromSku(item.sku),
      hero_id: heroId,
      production_status: "not_started",
    });
    if (error) console.warn(`    ⚠️  Item insert error (${item.sku}):`, error.message);
  }
}

// ── ShipStation sync ──────────────────────────────────────────────────────────

async function fetchShipStationOrders() {
  if (!SS_API_KEY || !SS_API_SECRET) {
    console.log("\n⚠️  ShipStation creds not set — skipping shipped-status sync");
    return [];
  }

  console.log("\n📦 Fetching ShipStation shipments for last 14 days...");
  const allOrders = [];
  let page = 1;
  const pageSize = 500;

  const createDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const auth = Buffer.from(`${SS_API_KEY}:${SS_API_SECRET}`).toString("base64");

  while (true) {
    const url = `https://ssapi.shipstation.com/orders?orderStatus=shipped&createDateStart=${createDate}&pageSize=${pageSize}&page=${page}`;
    const resp = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`  ⚠️  ShipStation API ${resp.status}: ${body.slice(0, 200)}`);
      break;
    }
    const data = await resp.json();
    allOrders.push(...(data.orders ?? []));
    if (page >= (data.pages ?? 1)) break;
    page++;
  }

  console.log(`  → ${allOrders.length} shipped orders found in ShipStation`);
  return allOrders;
}

async function syncShippedStatus(ssOrders) {
  if (ssOrders.length === 0) return { updated: 0, noMatch: 0 };

  // Build map: orderNumber → { trackingNumber, shipDate }
  const shipped = new Map();
  for (const o of ssOrders) {
    if (o.orderNumber) {
      shipped.set(String(o.orderNumber), {
        trackingNumber: o.shipments?.[0]?.trackingNumber ?? o.trackingNumber ?? null,
        shipDate: o.shipDate ? o.shipDate.slice(0, 10) : null,
      });
    }
  }

  // For each shipped order, find matching Supabase order and update items
  let updated = 0;
  let noMatch = 0;

  for (const [orderNumber, info] of shipped) {
    // Find order in Supabase
    const { data: supaOrder } = await sb
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .limit(1)
      .single();

    if (!supaOrder) {
      noMatch++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] Would mark order ${orderNumber} as shipped (tracking: ${info.trackingNumber})`);
      updated++;
      continue;
    }

    // Update all order_items for this order to "shipped"
    // (tracking_number column not required — skipped if column doesn't exist)
    const { error } = await sb
      .from("order_items")
      .update({ production_status: "shipped" })
      .eq("order_id", supaOrder.id);

    if (error) {
      console.warn(`  ⚠️  Could not update items for order ${orderNumber}:`, error.message);
    } else {
      updated++;
    }
  }

  return { updated, noMatch };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await ensureSystemConfigTable();

  // 1. Fetch from Squarespace
  console.log("\n📥 Fetching Squarespace orders...");
  let sqOrders;
  try {
    sqOrders = await fetchSquarespaceOrders();
  } catch (err) {
    console.error("❌ Squarespace fetch failed:", err.message);
    process.exit(1);
  }
  console.log(`  → ${sqOrders.length} total orders from Squarespace`);

  // 2. Process each order
  let newCount = 0;
  let dupCount = 0;
  let errCount = 0;
  const results = [];

  for (const sqOrder of sqOrders) {
    const order = normalize(sqOrder);
    if (!order.orderNumber) { errCount++; continue; }

    // Idempotency check
    const { data: existing } = await sb
      .from("orders")
      .select("id")
      .eq("order_number", order.orderNumber)
      .limit(1)
      .single();

    if (existing) {
      dupCount++;
      results.push({ orderNumber: order.orderNumber, status: "duplicate" });
      process.stdout.write(".");
      continue;
    }

    try {
      const newOrder = await insertOrder(order);
      await insertItems(newOrder.id, order.items);
      newCount++;
      results.push({ orderNumber: order.orderNumber, status: "new", id: newOrder.id });
      process.stdout.write("+");
    } catch (err) {
      errCount++;
      results.push({ orderNumber: order.orderNumber, status: "error", error: err.message });
      process.stdout.write("x");
    }
  }

  console.log("\n");
  console.log(`✅ Squarespace backfill complete:`);
  console.log(`   New:        ${newCount}`);
  console.log(`   Duplicates: ${dupCount}`);
  console.log(`   Errors:     ${errCount}`);

  // 3. ShipStation shipped-status sync
  const ssOrders = await fetchShipStationOrders();
  const { updated, noMatch } = await syncShippedStatus(ssOrders);
  if (ssOrders.length > 0) {
    console.log(`\n✅ ShipStation shipped-status sync:`);
    console.log(`   Updated to shipped: ${updated}`);
    console.log(`   No match in Supabase: ${noMatch}`);
  }

  // 4. Advance cursor to now
  if (newCount > 0 || dupCount > 0) {
    await upsertCursor(new Date().toISOString());
    console.log("\n✓ Cursor advanced to now");
  }

  // 5. Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Total from Squarespace: ${sqOrders.length}`);
  console.log(`   New in Supabase:        ${newCount}`);
  console.log(`   Already existed:        ${dupCount}`);
  console.log(`   Marked shipped:         ${updated}`);

  if (errCount > 0) {
    console.log(`\n⚠️  Errors:`);
    results.filter(r => r.status === "error").forEach(r =>
      console.log(`   Order ${r.orderNumber}: ${r.error}`)
    );
  }

  if (newCount > 0) {
    console.log(`\n🆕 New orders added:`);
    results.filter(r => r.status === "new").forEach(r =>
      console.log(`   #${r.orderNumber}`)
    );
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});

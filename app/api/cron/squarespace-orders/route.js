/**
 * Squarespace Orders Poller Cron
 *
 * Runs every 5 minutes. Fetches orders modified since the last successful run
 * from the Squarespace Commerce API v1, then hands each one to
 * processIncomingOrder (Supabase write → ShipStation push → Slack notify).
 *
 * Auth:      Vercel CRON_SECRET (Bearer) or SHOS_API_KEY header
 * Cursor:    Last sync ISO timestamp stored in Supabase system_config table
 * Idempotency: processIncomingOrder checks order_number before inserting,
 *              so duplicate fetches are safe (they return duplicate: true)
 *
 * Webhook route (/api/webhooks/squarespace) stays in place as a fallback;
 * this poller is the primary ingestion path.
 */

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { processIncomingOrder } from "@/lib/data/processIncomingOrder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SQ_API_BASE = "https://api.squarespace.com/1.0/commerce/orders";
const CURSOR_KEY = "squarespace_orders_last_sync";

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = request.headers.get("x-api-key");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (apiKey && key === apiKey) return true;
  return false;
}

// ── Cursor state (Supabase system_config table) ───────────────────────────────

async function getLastSyncTime(sb) {
  try {
    const { data } = await sb
      .from("system_config")
      .select("value")
      .eq("key", CURSOR_KEY)
      .limit(1)
      .single();
    return data?.value ?? null;
  } catch {
    // Table may not exist yet — caller falls back to a safe window
    return null;
  }
}

async function setLastSyncTime(sb, isoTimestamp) {
  try {
    await sb
      .from("system_config")
      .upsert({ key: CURSOR_KEY, value: isoTimestamp }, { onConflict: "key" });
  } catch (e) {
    console.warn("[sq-orders-cron] Could not persist cursor:", e.message);
  }
}

// ── Squarespace Commerce API ──────────────────────────────────────────────────

/**
 * Fetch all orders modified after `modifiedAfter`, following pagination cursors.
 * Returns a flat array of raw Squarespace order objects.
 */
async function fetchSquarespaceOrders(modifiedAfter) {
  const apiKey = process.env.SQUARESPACE_API_KEY;
  if (!apiKey) throw new Error("SQUARESPACE_API_KEY env var not set");

  const allOrders = [];
  let nextCursor = null;
  const modifiedBefore = new Date().toISOString();

  do {
    const url = new URL(SQ_API_BASE);
    if (nextCursor) {
      // When paginating with cursor, no other params allowed
      url.searchParams.set("cursor", nextCursor);
    } else if (modifiedAfter) {
      url.searchParams.set("modifiedAfter", modifiedAfter);
      url.searchParams.set("modifiedBefore", modifiedBefore);
    }

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "SHOS-Poller/1.0",
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Squarespace API ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    allOrders.push(...(data.result ?? []));
    nextCursor = data.pagination?.hasNextPage ? data.pagination.nextPageCursor : null;
  } while (nextCursor);

  return allOrders;
}

// ── Payload normalization ─────────────────────────────────────────────────────

/**
 * Map a raw Squarespace order object to the normalized shape expected by
 * processIncomingOrder. Mirrors the logic in the webhook route handler.
 *
 * Squarespace Commerce API order fields:
 *   orderNumber, createdOn, modifiedOn, customerEmail,
 *   billingAddress.{ firstName, lastName, address1, city, state, postalCode, countryCode }
 *   shippingAddress.{ ... }
 *   lineItems.[].{ sku, quantity, unitPricePaid.value, productName }
 *   customerMessage
 */
function normalizeSquarespaceOrder(sqOrder) {
  const bill = sqOrder.billingAddress ?? {};
  const ship = sqOrder.shippingAddress ?? bill; // fall back to billing if no shipping

  return {
    orderNumber: String(sqOrder.orderNumber ?? sqOrder.id ?? ""),
    orderDate: (sqOrder.createdOn ?? new Date().toISOString()).slice(0, 10),
    orderType: "paid",
    source: "squarespace",
    billingName: [bill.firstName, bill.lastName].filter(Boolean).join(" ").trim(),
    billingEmail: sqOrder.customerEmail ?? "",
    shippingName: [ship.firstName, ship.lastName].filter(Boolean).join(" ").trim(),
    shippingAddress1: ship.address1 ?? "",
    shippingCity: ship.city ?? "",
    shippingState: ship.state ?? "",
    shippingPostal: ship.postalCode ?? "",
    shippingCountry: ship.countryCode ?? "US",
    items: (sqOrder.lineItems ?? []).map((li) => ({
      sku: li.sku ?? "",
      quantity: li.quantity ?? 1,
      unitPrice: parseFloat(li.unitPricePaid?.value ?? li.unitPrice ?? 0),
      productName: li.productName ?? li.name ?? "",
    })),
    notes: sqOrder.customerMessage ?? null,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServerClient();

  // Snapshot the run start time BEFORE fetching — we'll advance the cursor to
  // this value so any orders that arrive during the run aren't skipped.
  const runStart = new Date().toISOString();

  // Resolve the polling window
  let modifiedAfter = await getLastSyncTime(sb);
  if (!modifiedAfter) {
    // No cursor yet — fetch the last 10 minutes as a safe bootstrap window.
    // processIncomingOrder idempotency prevents any double-processing.
    modifiedAfter = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    console.log(`[sq-orders-cron] No cursor — bootstrap window: ${modifiedAfter}`);
  }

  console.log(`[sq-orders-cron] Polling orders modified after ${modifiedAfter}`);

  // Fetch from Squarespace
  let orders;
  try {
    orders = await fetchSquarespaceOrders(modifiedAfter);
  } catch (err) {
    console.error("[sq-orders-cron] Squarespace API fetch failed:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 502 });
  }

  console.log(`[sq-orders-cron] Fetched ${orders.length} order(s)`);

  // Process each order
  const results = [];
  for (const sqOrder of orders) {
    const normalized = normalizeSquarespaceOrder(sqOrder);
    if (!normalized.orderNumber) {
      results.push({ orderNumber: null, success: false, error: "missing orderNumber" });
      continue;
    }

    try {
      const result = await processIncomingOrder(normalized);
      results.push({
        orderNumber: normalized.orderNumber,
        success: result.success,
        duplicate: result.duplicate ?? false,
        orderId: result.orderId,
      });
    } catch (err) {
      console.error(`[sq-orders-cron] processIncomingOrder failed for #${normalized.orderNumber}:`, err.message);
      results.push({
        orderNumber: normalized.orderNumber,
        success: false,
        error: err.message,
      });
    }
  }

  // Advance cursor to run start so next poll picks up where this one started
  await setLastSyncTime(sb, runStart);

  const newCount = results.filter((r) => r.success && !r.duplicate).length;
  const dupCount = results.filter((r) => r.duplicate).length;
  const errCount = results.filter((r) => !r.success).length;

  console.log(`[sq-orders-cron] Complete — new: ${newCount}, duplicates: ${dupCount}, errors: ${errCount}`);

  return NextResponse.json({
    success: true,
    polledAfter: modifiedAfter,
    fetched: orders.length,
    new: newCount,
    duplicates: dupCount,
    errors: errCount,
    results,
  });
}

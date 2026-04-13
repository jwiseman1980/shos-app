/**
 * processIncomingOrder — shared order intake processor
 *
 * Called by any webhook handler (Squarespace, Stripe, etc.) after they have
 * normalized their source-specific payload into a common order shape.
 *
 * Responsibilities:
 *   1. Idempotency check — skip if order_number already in Supabase
 *   2. Write order + line items to Supabase
 *   3. Resolve hero IDs from SKUs
 *   4. Auto-triage so the order advances immediately
 *   5. Push to ShipStation (best-effort — never blocks Supabase write)
 *   6. Post Slack notification
 *
 * Returns a result object the calling route can forward as JSON.
 *
 * Adding a new source (e.g., Stripe):
 *   - Create app/api/webhooks/stripe/route.js
 *   - Validate Stripe signature, map Stripe payload → normalized shape below
 *   - Call processIncomingOrder({ source: "stripe", ...normalizedFields })
 */

import { getServerClient } from "@/lib/supabase";
import { triageNeedsDecision } from "@/lib/data/orders";
import { createOrder as ssCreateOrder } from "@/lib/shipstation";

/**
 * Extract base SKU (strips size/variant suffix).
 * ARMY-STEVENSON-7D → ARMY-STEVENSON
 */
function toBaseSku(sku) {
  if (!sku) return "";
  return sku
    .replace(/-[67]D$/i, "")
    .replace(/-[67]$/i, "")
    .replace(/-D$/i, "");
}

/**
 * Derive bracelet size from SKU suffix.
 */
function sizeFromSku(sku) {
  if (!sku) return "Regular-7in";
  if (/-6D?$/i.test(sku)) return "Small-6in";
  return "Regular-7in";
}

/**
 * Look up a hero ID by base SKU (case-insensitive).
 * Returns null if not found — item is still created without a hero link.
 */
async function findHeroBySku(sb, sku) {
  if (!sku) return null;
  const base = toBaseSku(sku);
  if (!base) return null;
  const { data } = await sb
    .from("heroes")
    .select("id")
    .ilike("lineitem_sku", base)
    .limit(1)
    .single();
  return data?.id ?? null;
}

/**
 * Build the ShipStation order payload for a paid Squarespace/Stripe order.
 *
 * Status is "awaiting_shipment" — ShipStation holds the record and the
 * shipping team can print labels once production marks items ready_to_ship.
 * ShipStation's createOrder endpoint is idempotent on orderNumber, so
 * duplicate calls (retries, dual integrations) are safe.
 */
function buildShipStationOrder({ orderNumber, orderDate, billingName, billingEmail, shippingName, shippingAddress1, shippingCity, shippingState, shippingPostal, shippingCountry, items, notes }) {
  return {
    orderNumber,
    orderDate: orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
    orderStatus: "awaiting_shipment",
    billTo: {
      name: billingName || shippingName || "Steel Hearts Customer",
    },
    shipTo: {
      name: shippingName || billingName || "",
      street1: shippingAddress1 || "",
      city: shippingCity || "",
      state: shippingState || "",
      postalCode: shippingPostal || "",
      country: shippingCountry || "US",
    },
    items: items.map((item) => ({
      sku: item.sku || "",
      name: item.productName || item.sku || "Memorial Bracelet",
      quantity: item.quantity || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
    })),
    customerEmail: billingEmail || "",
    amountPaid: items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) || 0) * (item.quantity || 1), 0),
    shippingAmount: 0,
    taxAmount: 0,
    internalNotes: notes || "",
  };
}

/**
 * Main processor — call this from any webhook handler.
 *
 * @param {Object} params
 * @param {string}  params.orderNumber       — Required. Human-readable order number.
 * @param {string}  params.orderDate         — ISO date string (YYYY-MM-DD or full ISO).
 * @param {string}  params.orderType         — 'paid' | 'donated' | 'wholesale' | 'gift' | 'replacement'
 * @param {string}  params.source            — 'squarespace' | 'stripe' | etc.
 * @param {string}  params.billingName
 * @param {string}  params.billingEmail
 * @param {string}  params.shippingName
 * @param {string}  params.shippingAddress1
 * @param {string}  params.shippingCity
 * @param {string}  params.shippingState
 * @param {string}  params.shippingPostal
 * @param {string}  params.shippingCountry
 * @param {Array}   params.items             — [{ sku, quantity, unitPrice, productName }]
 * @param {string}  params.notes
 *
 * @returns {Object} result
 */
export async function processIncomingOrder({
  orderNumber,
  orderDate,
  orderType = "paid",
  source = "squarespace",
  billingName,
  billingEmail,
  shippingName,
  shippingAddress1,
  shippingCity,
  shippingState,
  shippingPostal,
  shippingCountry = "US",
  items = [],
  notes,
}) {
  const sb = getServerClient();

  // ── 1. Idempotency check ────────────────────────────────────────────────
  if (orderNumber) {
    const { data: existing } = await sb
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .limit(1)
      .single();

    if (existing) {
      return {
        success: true,
        duplicate: true,
        orderId: existing.id,
        orderNumber,
        message: `Order ${orderNumber} already exists — skipped`,
      };
    }
  }

  // ── 2. Write order to Supabase ──────────────────────────────────────────
  const { data: order, error: orderErr } = await sb
    .from("orders")
    .insert({
      order_number: orderNumber,
      order_date: orderDate ? orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      order_type: orderType,
      billing_name: billingName,
      billing_email: billingEmail,
      shipping_name: shippingName,
      shipping_address1: shippingAddress1,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal: shippingPostal,
      shipping_country: shippingCountry,
      source,
      notes,
    })
    .select("id")
    .single();

  if (orderErr) throw orderErr;

  // ── 3. Write line items ─────────────────────────────────────────────────
  const itemResults = [];

  for (const item of items) {
    const sku = item.sku || "";
    const heroId = await findHeroBySku(sb, sku);

    const { data: newItem, error: itemErr } = await sb
      .from("order_items")
      .insert({
        order_id: order.id,
        lineitem_sku: sku,
        quantity: item.quantity || 1,
        unit_price: parseFloat(item.unitPrice) || 0,
        bracelet_size: sizeFromSku(sku),
        hero_id: heroId,
        production_status: "not_started",
        notes: item.notes || null,
      })
      .select("id")
      .single();

    if (itemErr) {
      console.error(`[processIncomingOrder] Item insert error for SKU ${sku}:`, itemErr.message);
      itemResults.push({ sku, error: itemErr.message });
    } else {
      itemResults.push({ sku, id: newItem.id, heroId });
    }
  }

  // ── 4. Auto-triage ──────────────────────────────────────────────────────
  let triageResult = null;
  try {
    triageResult = await triageNeedsDecision();
  } catch (e) {
    console.warn("[processIncomingOrder] Post-insert triage failed:", e.message);
  }

  // ── 5. ShipStation push (best-effort) ───────────────────────────────────
  let shipStationResult = null;
  try {
    const ssOrder = buildShipStationOrder({
      orderNumber,
      orderDate,
      billingName,
      billingEmail,
      shippingName,
      shippingAddress1,
      shippingCity,
      shippingState,
      shippingPostal,
      shippingCountry,
      items,
      notes,
    });
    shipStationResult = await ssCreateOrder(ssOrder);
  } catch (e) {
    // Log but never fail the response — Supabase write already succeeded
    console.error("[processIncomingOrder] ShipStation push failed:", e.message);
    shipStationResult = { error: e.message };
  }

  // ── 6. Slack notification ───────────────────────────────────────────────
  const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
  if (slackWebhook) {
    try {
      const triageNote = triageResult
        ? ` — ${triageResult.advanced} to laser, ${triageResult.fromStock} from stock, ${triageResult.needsDesign} need design`
        : "";
      const ssNote = shipStationResult?.error
        ? " ⚠️ ShipStation push failed"
        : " ✓ ShipStation";
      await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🛒 New ${source} order #${orderNumber}: ${items.length} item(s) for ${billingName || shippingName || "unknown"}${triageNote}${ssNote}`,
        }),
      });
    } catch {}
  }

  return {
    success: true,
    duplicate: false,
    orderId: order.id,
    orderNumber,
    items: itemResults,
    triage: triageResult
      ? {
          advanced: triageResult.advanced,
          fromStock: triageResult.fromStock,
          needsDesign: triageResult.needsDesign,
        }
      : null,
    shipStation: shipStationResult?.error
      ? { error: shipStationResult.error }
      : { orderId: shipStationResult?.orderId, orderKey: shipStationResult?.orderKey },
    message: `Order ${orderNumber} created with ${itemResults.length} item(s)`,
  };
}

/**
 * GET /api/orders/status
 *
 * Dispatch-accessible order status endpoint.
 * Combines Supabase (production pipeline) + ShipStation (shipping status).
 *
 * Auth: x-api-key header (SHOS_API_KEY) or active session cookie
 *       — handled by middleware.js, no additional auth needed here.
 *
 * Query params:
 *   ?order_number=16146   — look up a specific order
 *   ?recent=true          — return last 10 orders (optional &limit=N, max 50)
 */

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { listOrders as ssListOrders } from "@/lib/shipstation";

// Maps production_status → who owns this step
const ASSIGNED_TO_MAP = {
  not_started: "unassigned",
  design_needed: "Ryan (design)",
  ready_to_laser: "Joseph (laser)",
  in_production: "Joseph (laser)",
  ready_to_ship: "Kristin (shipping)",
  shipped: "Kristin (shipped)",
  delivered: "delivered",
  cancelled: "cancelled",
};

// Status ordering — lower index = more blocked / earlier in pipeline
const STATUS_ORDER = [
  "not_started",
  "design_needed",
  "ready_to_laser",
  "in_production",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
];

/** Derive overall order production status from its items (earliest-stage item wins) */
function overallProductionStatus(items) {
  if (!items || items.length === 0) return "unknown";
  return items.reduce((worst, item) => {
    const a = STATUS_ORDER.indexOf(item.production_status ?? "not_started");
    const b = STATUS_ORDER.indexOf(worst);
    return a < b ? item.production_status : worst;
  }, "shipped");
}

/** Pull order + items + hero names from Supabase */
async function supabaseOrderByNumber(orderNumber) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("orders")
    .select(`
      id, order_number, order_type, order_date,
      billing_name, billing_email,
      shipping_name, shipping_address1, shipping_city, shipping_state, shipping_postal,
      source, notes, created_at, updated_at,
      order_items (
        id, lineitem_sku, quantity, unit_price, bracelet_size,
        production_status, notes, created_at, updated_at,
        hero:heroes!hero_id ( name, rank, branch )
      )
    `)
    .eq("order_number", orderNumber)
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

/** Pull last N orders from Supabase */
async function supabaseRecentOrders(limit = 10) {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("orders")
    .select(`
      id, order_number, order_type, order_date,
      billing_name, billing_email,
      shipping_name, shipping_address1, shipping_city, shipping_state, shipping_postal,
      source, notes, created_at, updated_at,
      order_items (
        id, lineitem_sku, quantity, unit_price, bracelet_size,
        production_status, notes, created_at, updated_at,
        hero:heroes!hero_id ( name, rank, branch )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 50));

  if (error) throw error;
  return data ?? [];
}

/**
 * Look up a ShipStation order by order number.
 * Tries awaiting_shipment first (most common), then shipped.
 * Returns null on any error rather than crashing the response.
 */
async function shipstationByOrderNumber(orderNumber) {
  try {
    // Check all statuses: awaiting_shipment, shipped, on_hold, cancelled
    const [awaiting, shipped] = await Promise.all([
      ssListOrders({ orderNumber, pageSize: 5 }),
      ssListOrders({ orderNumber, orderStatus: "shipped", pageSize: 5 }),
    ]);

    return (
      awaiting?.orders?.[0] ??
      shipped?.orders?.[0] ??
      null
    );
  } catch (err) {
    console.warn(`ShipStation lookup failed for ${orderNumber}:`, err.message);
    return null;
  }
}

/** Build the clean combined response shape for a single order */
function formatOrder(sbOrder, ssOrder) {
  const items = (sbOrder.order_items ?? []).map((item) => {
    const heroName = item.hero?.name ?? null;
    const heroRank = item.hero?.rank ?? null;
    const heroBranch = item.hero?.branch ?? null;

    const description = heroName
      ? [heroRank, heroName].filter(Boolean).join(" ")
      : item.lineitem_sku ?? "Unknown item";

    return {
      item_id: item.id,
      sku: item.lineitem_sku,
      description,
      branch: heroBranch,
      size: item.bracelet_size ?? extractSizeFromSku(item.lineitem_sku),
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price,
      production_status: item.production_status,
      assigned_to: ASSIGNED_TO_MAP[item.production_status] ?? "unknown",
      notes: item.notes,
      last_updated: item.updated_at,
    };
  });

  // ShipStation shipping data
  let shipstation = null;
  if (ssOrder) {
    const shipment = ssOrder.shipments?.[0] ?? null;
    shipstation = {
      status: ssOrder.orderStatus ?? null,
      tracking_number: shipment?.trackingNumber ?? null,
      carrier: shipment?.carrierCode ?? null,
      ship_date: ssOrder.shipDate ?? shipment?.shipDate ?? null,
      shipstation_order_id: ssOrder.orderId ?? null,
    };
  }

  return {
    order_number: sbOrder.order_number,
    customer_name: sbOrder.shipping_name ?? sbOrder.billing_name ?? null,
    customer_email: sbOrder.billing_email ?? null,
    order_date: sbOrder.order_date,
    order_type: sbOrder.order_type,
    source: sbOrder.source,
    items,
    production_status: overallProductionStatus(items),
    shipstation,
    notes: sbOrder.notes,
    last_updated: sbOrder.updated_at,
    created_at: sbOrder.created_at,
    supabase_id: sbOrder.id,
  };
}

/** Extract bracelet size from a SKU like ARMY-SMITH-7 or ARMY-SMITH-6D */
function extractSizeFromSku(sku) {
  if (!sku) return null;
  const m = sku.match(/-([67])D?$/);
  return m ? m[1] : null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get("order_number");
  const recent = searchParams.get("recent");
  const limitParam = parseInt(searchParams.get("limit") ?? "10", 10);

  if (!orderNumber && !recent) {
    return NextResponse.json(
      { error: "Provide ?order_number=XXXX or ?recent=true" },
      { status: 400 }
    );
  }

  try {
    if (orderNumber) {
      // ── Single order lookup ──────────────────────────────────────────────
      const [sbOrder, ssOrder] = await Promise.all([
        supabaseOrderByNumber(orderNumber),
        shipstationByOrderNumber(orderNumber),
      ]);

      if (!sbOrder) {
        return NextResponse.json(
          {
            error: `Order ${orderNumber} not found in Supabase`,
            shipstation: ssOrder
              ? {
                  status: ssOrder.orderStatus,
                  tracking_number: ssOrder.shipments?.[0]?.trackingNumber ?? null,
                  ship_date: ssOrder.shipDate ?? null,
                }
              : null,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        order: formatOrder(sbOrder, ssOrder),
      });
    }

    // ── Recent orders ──────────────────────────────────────────────────────
    const limit = isNaN(limitParam) || limitParam < 1 ? 10 : limitParam;
    const sbOrders = await supabaseRecentOrders(limit);

    // Fetch ShipStation data in parallel for all recent orders
    const ssResults = await Promise.all(
      sbOrders.map((o) =>
        o.order_number ? shipstationByOrderNumber(o.order_number) : null
      )
    );

    const orders = sbOrders.map((sbOrder, i) =>
      formatOrder(sbOrder, ssResults[i])
    );

    return NextResponse.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err) {
    console.error("GET /api/orders/status error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

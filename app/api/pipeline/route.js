// /api/pipeline — unified operator board for the bracelet lifecycle.
//
// Collapses the 15 hero workflow stages into 9 operator-friendly columns,
// merges in ShipStation awaiting_shipment, and enriches each card with the
// hero's order count + a derived blocker hint.

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { STAGES, STAGE_LABEL, isValidStage } from "@/lib/hero-workflow";
import { getAwaitingShipment } from "@/lib/shipstation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 9-column collapsed pipeline. Order matters — left to right is operator flow.
export const COLUMNS = [
  {
    key: "new_inquiries",
    label: "New Inquiries",
    description: "Form submissions / email requests not yet acted on",
    stages: ["inquiry", "researching"],
  },
  {
    key: "in_contact",
    label: "In Contact",
    description: "Confirming sizes / family approval / details",
    stages: ["hero_created", "contacting_requestor"],
  },
  {
    key: "design_requested",
    label: "Design Requested",
    description: "Brief sent to Ryan, waiting on SVGs",
    stages: ["design_briefed"],
  },
  {
    key: "design_received",
    label: "Design Received",
    description: "Ryan delivered, ready to send proof",
    stages: ["design_received"],
  },
  {
    key: "proof_sent",
    label: "Proof Sent",
    description: "Awaiting requestor approval",
    stages: ["proof_sent"],
  },
  {
    key: "in_production",
    label: "In Production",
    description: "Approved, lasering / shaping / photographing",
    stages: ["approved_production", "lasering", "photographing", "letter_drafted", "social_posted"],
  },
  {
    key: "ready_to_ship",
    label: "Ready to Ship",
    description: "ShipStation awaiting_shipment + ready_to_ship orders",
    stages: [], // populated from ShipStation + supabase orders, not workflow_stage
  },
  {
    key: "shipped",
    label: "Shipped",
    description: "Out the door",
    stages: ["shipped"],
  },
  {
    key: "listed",
    label: "Listed on Site",
    description: "Product page live",
    stages: ["listed", "complete"],
  },
];

// stage -> column key (reverse map for quick bucketing)
const STAGE_TO_COLUMN = (() => {
  const m = {};
  for (const col of COLUMNS) {
    for (const s of col.stages) m[s] = col.key;
  }
  return m;
})();

// One-liner blocker hint when no explicit workflow_blockers value is set.
function deriveBlocker(hero, orderCounts) {
  const stage = hero.workflow_stage;
  switch (stage) {
    case "inquiry":
    case "researching":
      return "Waiting on Joseph";
    case "hero_created":
    case "contacting_requestor":
      return "Waiting on family";
    case "design_briefed":
      return hero.has_graphic_design ? null : "Waiting on Ryan";
    case "design_received":
      return "Waiting on Joseph (send proof)";
    case "proof_sent":
      return "Waiting on requestor";
    case "approved_production":
      return "Start laser run";
    case "lasering":
      return "On the laser";
    case "photographing":
      return "Shape + photograph";
    case "letter_drafted":
      return "Send family letter";
    case "social_posted":
      return "Ready to ship";
    case "shipped":
      return null;
    case "listed":
      return hero.active_listing ? "Set anniversary tracking" : "Publish on website";
    case "complete":
      return null;
    default:
      return null;
  }
}

function fullName(hero) {
  return [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ") || hero.name;
}

function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function inferOrderType(hero, orderTypes) {
  if (orderTypes && orderTypes.size > 0) {
    if (orderTypes.has("donated")) return "donated";
    if (orderTypes.has("wholesale")) return "wholesale";
    if (orderTypes.has("paid")) return "paid";
    return Array.from(orderTypes)[0];
  }
  return "inquiry";
}

export async function GET() {
  const sb = getServerClient();

  const [heroesResult, orderItemsResult, ssResult] = await Promise.allSettled([
    sb
      .from("heroes")
      .select(`
        id, name, first_name, last_name, rank, lineitem_sku, branch,
        workflow_stage, workflow_updated_at, workflow_blockers,
        design_status, has_graphic_design, active_listing,
        family_contact:contacts!family_contact_id(first_name, last_name, email)
      `)
      .not("workflow_stage", "is", null)
      .order("workflow_updated_at", { ascending: false }),
    sb
      .from("order_items")
      .select(`
        id, hero_id, production_status, quantity,
        order:orders!order_id(order_type)
      `)
      .not("hero_id", "is", null)
      .neq("production_status", "shipped")
      .neq("production_status", "delivered")
      .neq("production_status", "cancelled"),
    getAwaitingShipment().catch((err) => {
      console.warn("[pipeline] ShipStation fetch failed:", err.message);
      return null;
    }),
  ]);

  // Heroes: graceful fallback if migration not yet applied.
  let heroes = [];
  let migrationPending = false;
  if (heroesResult.status === "fulfilled") {
    if (heroesResult.value.error) {
      const msg = heroesResult.value.error.message || "";
      if (/workflow_(stage|updated_at|blockers)|schema cache/i.test(msg)) {
        migrationPending = true;
      } else {
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    } else {
      heroes = heroesResult.value.data || [];
    }
  }

  const orderItems = orderItemsResult.status === "fulfilled" && !orderItemsResult.value.error
    ? orderItemsResult.value.data || []
    : [];

  // Aggregate orders per hero: count, total quantity, set of order_types, max status priority.
  const orderAgg = new Map(); // hero_id -> { count, qty, types, hasReadyToShip }
  for (const it of orderItems) {
    const hid = it.hero_id;
    if (!hid) continue;
    const e = orderAgg.get(hid) || { count: 0, qty: 0, types: new Set(), hasReadyToShip: false };
    e.count += 1;
    e.qty += it.quantity || 0;
    if (it.order?.order_type) e.types.add(it.order.order_type);
    if (it.production_status === "ready_to_ship") e.hasReadyToShip = true;
    orderAgg.set(hid, e);
  }

  // Build columns. Empty buckets up front so the UI always has all 9.
  const byColumn = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
  const counts = Object.fromEntries(COLUMNS.map((c) => [c.key, 0]));

  for (const hero of heroes) {
    const stage = hero.workflow_stage;
    if (!isValidStage(stage)) continue;
    const colKey = STAGE_TO_COLUMN[stage];
    if (!colKey) continue;

    const agg = orderAgg.get(hero.id);

    byColumn[colKey].push({
      id: `hero-${hero.id}`,
      kind: "hero",
      heroId: hero.id,
      name: fullName(hero),
      sku: hero.lineitem_sku || null,
      branch: hero.branch || null,
      stage,
      stageLabel: STAGE_LABEL[stage] || stage,
      type: inferOrderType(hero, agg?.types),
      orderCount: agg?.count || 0,
      orderQty: agg?.qty || 0,
      daysInStage: daysSince(hero.workflow_updated_at),
      blocker: hero.workflow_blockers || deriveBlocker(hero, agg),
      updatedAt: hero.workflow_updated_at,
    });
    counts[colKey] += 1;
  }

  // ShipStation enrichment: append awaiting_shipment orders to "Ready to Ship".
  // Each order is one card. If we already track the hero on the same SKU, we
  // still surface the ShipStation card — operators want to see the actual queue.
  const ssOrders = ssResult.status === "fulfilled" && ssResult.value
    ? (ssResult.value.orders || [])
    : [];

  for (const o of ssOrders) {
    const skus = (o.items || []).map((i) => i.sku).filter(Boolean);
    const primarySku = skus[0] || null;
    const itemSummary = (o.items || []).map((i) => `${i.quantity}× ${i.sku || i.name}`).join(", ");
    byColumn.ready_to_ship.push({
      id: `ss-${o.orderId}`,
      kind: "shipstation",
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      name: o.shipTo?.name || o.customerEmail || `SS Order ${o.orderNumber}`,
      sku: primarySku,
      type: o.orderTotal === 0 ? "donated" : "paid",
      itemSummary,
      daysInStage: o.orderDate ? daysSince(o.orderDate) : null,
      blocker: "Print label + ship",
      updatedAt: o.modifyDate || o.orderDate,
    });
    counts.ready_to_ship += 1;
  }

  // Sort each column by days-in-stage (oldest first → action first).
  for (const key of Object.keys(byColumn)) {
    byColumn[key].sort((a, b) => (b.daysInStage ?? 0) - (a.daysInStage ?? 0));
  }

  return NextResponse.json({
    success: true,
    columns: COLUMNS.map((c) => ({ key: c.key, label: c.label, description: c.description })),
    byColumn,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    migrationPending,
    shipStationOk: ssResult.status === "fulfilled" && ssResult.value !== null,
    generatedAt: new Date().toISOString(),
  });
}

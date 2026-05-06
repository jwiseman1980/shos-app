import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { getOrderStats } from "@/lib/data/orders";
import { listOrders } from "@/lib/shipstation";

/**
 * GET /api/dashboard/counts
 *
 * Returns live badge counts for the sidebar and Today dashboard:
 *   ordersToLaser, ordersInProduction, ordersToShip, ordersNeedDesign,
 *   anniversariesPending (this month), totalActiveOrders.
 *
 * totalActiveOrders is the ShipStation outstanding count — what hasn't
 * shipped according to the only source of truth that matters for shipping.
 */
export const dynamic = "force-dynamic";

async function safeAnniversaryRows(sb, month) {
  try {
    const { data, error } = await sb
      .from("heroes")
      .select("id, anniversary_status")
      .eq("memorial_month", month)
      .eq("active_listing", true);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("[dashboard/counts] anniversaries fetch failed:", err.message);
    return [];
  }
}

async function safeShipStationOutstanding() {
  try {
    const [aw, oh] = await Promise.all([
      listOrders({ orderStatus: "awaiting_shipment", pageSize: 200 }).catch(() => null),
      listOrders({ orderStatus: "on_hold", pageSize: 200 }).catch(() => null),
    ]);
    return (aw?.orders?.length || 0) + (oh?.orders?.length || 0);
  } catch (err) {
    console.warn("[dashboard/counts] shipstation fetch failed:", err.message);
    return 0;
  }
}

async function safeOrderStats() {
  try {
    return await getOrderStats();
  } catch (err) {
    console.warn("[dashboard/counts] order stats failed:", err.message);
    return {};
  }
}

export async function GET() {
  try {
    const sb = getServerClient();
    const month = new Date().getMonth() + 1;

    const [orderStats, anniversaryRows, totalActiveOrders] = await Promise.all([
      safeOrderStats(),
      safeAnniversaryRows(sb, month),
      safeShipStationOutstanding(),
    ]);

    const anniversariesPending = anniversaryRows.filter((h) => {
      const s = (h.anniversary_status || "").toLowerCase().replace(/\s+/g, "_");
      return !["sent", "email_sent", "complete", "completed", "skipped", "scheduled"].includes(s);
    }).length;

    return NextResponse.json({
      ordersToLaser: orderStats.readyToLaser || 0,
      ordersInProduction: orderStats.inProduction || 0,
      ordersToShip: orderStats.readyToShip || 0,
      ordersNeedDesign: orderStats.designNeeded || 0,
      anniversariesPending,
      totalActiveOrders,
    });
  } catch (err) {
    console.error("[dashboard/counts] error:", err.message);
    return NextResponse.json({
      ordersToLaser: 0,
      ordersInProduction: 0,
      ordersToShip: 0,
      ordersNeedDesign: 0,
      anniversariesPending: 0,
      totalActiveOrders: 0,
    });
  }
}

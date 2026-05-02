import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { getOrderStats } from "@/lib/data/orders";

/**
 * GET /api/dashboard/counts
 *
 * Returns live badge counts for the sidebar and Today dashboard:
 *   ordersToLaser, ordersInProduction, ordersToShip, ordersNeedDesign,
 *   anniversariesPending (this month), totalActiveOrders
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = getServerClient();
    const month = new Date().getMonth() + 1;

    const [orderStats, anniversaryResult] = await Promise.all([
      getOrderStats().catch(() => ({})),
      sb
        .from("heroes")
        .select("id, anniversary_status")
        .eq("memorial_month", month)
        .eq("active_listing", true)
        .catch(() => ({ data: [] })),
    ]);

    const anniversariesPending = (anniversaryResult.data || []).filter((h) => {
      const s = (h.anniversary_status || "").toLowerCase().replace(/\s+/g, "_");
      return !["sent", "email_sent", "complete", "completed", "skipped", "scheduled"].includes(s);
    }).length;

    return NextResponse.json({
      ordersToLaser: orderStats.readyToLaser || 0,
      ordersInProduction: orderStats.inProduction || 0,
      ordersToShip: orderStats.readyToShip || 0,
      ordersNeedDesign: orderStats.designNeeded || 0,
      anniversariesPending,
      totalActiveOrders: orderStats.totalActive || 0,
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

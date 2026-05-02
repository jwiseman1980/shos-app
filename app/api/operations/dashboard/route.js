import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";

/**
 * GET /api/operations/dashboard
 * Aggregates operational and sales data for the Operations Dashboard.
 */
export async function GET() {
  try {
    const authed = await isAuthenticated();
    if (!authed) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sb = getServerClient();

    // --- 1. Order Pipeline Stats (by production_status) ---
    const pipelineStatuses = [
      "not_started",
      "design_needed",
      "ready_to_laser",
      "in_production",
      "ready_to_ship",
      "shipped",
    ];
    const pipelineCounts = {};
    for (const s of pipelineStatuses) {
      const { count, error } = await sb
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("production_status", s);
      pipelineCounts[s] = error ? 0 : count;
    }

    // --- 2. Orders by type (paid vs donated) with item quantities ---
    const [paidRes, donatedRes] = await Promise.all([
      sb.from("orders").select("id", { count: "exact", head: true }).eq("order_type", "paid"),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("order_type", "donated"),
    ]);
    const totalPaidOrders = paidRes.count || 0;
    const totalDonatedOrders = donatedRes.count || 0;

    // Quantities by type
    const { data: paidQtyRows } = await sb
      .from("order_items")
      .select("quantity, order:orders!order_id(order_type)")
      .eq("order.order_type", "paid");
    const paidQty = (paidQtyRows || []).reduce((s, r) => s + (r.quantity || 1), 0);

    const { data: donatedQtyRows } = await sb
      .from("order_items")
      .select("quantity, order:orders!order_id(order_type)")
      .eq("order.order_type", "donated");
    const donatedQty = (donatedQtyRows || []).reduce((s, r) => s + (r.quantity || 1), 0);

    // --- 3. Recent Orders (last 30 days) ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const { data: recentOrders } = await sb
      .from("order_items")
      .select(`
        id, lineitem_sku, quantity, unit_price, production_status, bracelet_size, created_at,
        order:orders!order_id(order_number, order_type, order_date, billing_name, shipping_name),
        hero:heroes!hero_id(name)
      `)
      .gte("order.order_date", cutoff)
      .order("created_at", { ascending: false })
      .limit(15);

    const recentOrdersMapped = (recentOrders || []).map((r) => ({
      id: r.id,
      heroName: r.hero?.name || r.lineitem_sku || "Unknown",
      sku: r.lineitem_sku || "",
      quantity: r.quantity || 1,
      unitPrice: r.unit_price || 0,
      status: r.production_status || "not_started",
      orderNumber: r.order?.order_number || "",
      orderType: r.order?.order_type || "",
      orderDate: r.order?.order_date || "",
      customer: r.order?.billing_name || r.order?.shipping_name || "",
    }));

    // --- 4. Shipping Turnaround ---
    const { data: shippedItems } = await sb
      .from("order_items")
      .select("updated_at, order:orders!order_id(order_date)")
      .eq("production_status", "shipped")
      .not("order.order_date", "is", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    let avgTurnaroundDays = null;
    if (shippedItems && shippedItems.length > 0) {
      const turnarounds = shippedItems
        .filter((r) => r.order?.order_date && r.updated_at)
        .map((r) => {
          const ordered = new Date(r.order.order_date);
          const shipped = new Date(r.updated_at);
          return (shipped - ordered) / (1000 * 60 * 60 * 24);
        })
        .filter((d) => d >= 0 && d < 365);

      if (turnarounds.length > 0) {
        avgTurnaroundDays = Math.round(
          (turnarounds.reduce((s, d) => s + d, 0) / turnarounds.length) * 10
        ) / 10;
      }
    }

    // --- 5. Hero Leaderboard (most bracelets sold/donated) ---
    const { data: leaderboardRows } = await sb
      .from("order_items")
      .select("hero_id, quantity, hero:heroes!hero_id(name, branch)")
      .not("hero_id", "is", null);

    const heroTotals = {};
    for (const r of leaderboardRows || []) {
      const hid = r.hero_id;
      if (!hid) continue;
      if (!heroTotals[hid]) {
        heroTotals[hid] = {
          heroId: hid,
          heroName: r.hero?.name || "Unknown",
          branch: r.hero?.branch || "",
          totalBracelets: 0,
        };
      }
      heroTotals[hid].totalBracelets += r.quantity || 1;
    }
    const heroLeaderboard = Object.values(heroTotals)
      .sort((a, b) => b.totalBracelets - a.totalBracelets)
      .slice(0, 10);

    // --- 6. Inventory (heroes with on-hand stock) ---
    const { data: inventoryRows } = await sb
      .from("heroes")
      .select("id, name, branch, lineitem_sku, on_hand_7in, on_hand_6in, total_on_hand")
      .eq("active_listing", true)
      .gt("total_on_hand", 0)
      .order("total_on_hand", { ascending: false })
      .limit(25);

    const inventory = (inventoryRows || []).map((r) => ({
      id: r.id,
      name: r.name,
      branch: r.branch || "",
      sku: r.lineitem_sku || "",
      onHand7: r.on_hand_7in || 0,
      onHand6: r.on_hand_6in || 0,
      total: r.total_on_hand || 0,
    }));

    const totalInventory = inventory.reduce((s, r) => s + r.total, 0);

    // --- 7. Anniversary Cycle Stats (this month) ---
    const currentMonth = new Date().getMonth() + 1;
    const { data: annHeroes } = await sb
      .from("heroes")
      .select("id, anniversary_status")
      .eq("memorial_month", currentMonth)
      .eq("active_listing", true);

    const annTotal = (annHeroes || []).length;
    const annComplete = (annHeroes || []).filter(
      (h) => h.anniversary_status === "complete" || h.anniversary_status === "social_posted"
    ).length;
    const annOverdue = (annHeroes || []).filter(
      (h) =>
        !h.anniversary_status ||
        h.anniversary_status === "not_started" ||
        h.anniversary_status === "prep"
    ).length;
    const annCompletionPct = annTotal > 0 ? Math.round((annComplete / annTotal) * 100) : 0;

    return NextResponse.json({
      success: true,
      pipeline: pipelineCounts,
      ordersByType: {
        paidOrders: totalPaidOrders,
        donatedOrders: totalDonatedOrders,
        paidBracelets: paidQty,
        donatedBracelets: donatedQty,
      },
      recentOrders: recentOrdersMapped,
      shipping: {
        avgTurnaroundDays,
        shippedCount: pipelineCounts.shipped || 0,
      },
      heroLeaderboard,
      inventory,
      inventoryTotal: totalInventory,
      anniversary: {
        month: currentMonth,
        total: annTotal,
        complete: annComplete,
        overdue: annOverdue,
        completionPct: annCompletionPct,
      },
    });
  } catch (error) {
    console.error("Operations dashboard error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

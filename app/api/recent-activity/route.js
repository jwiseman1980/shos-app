import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/recent-activity
 * Returns a merged feed of recent operational events for the dashboard activity strip.
 *
 * Sources:
 *   - orders placed (orders.created_at, last 14 days)
 *   - bracelets shipped (order_items where production_status = 'shipped', last 14 days)
 *   - execution log (completed work sessions, last 48 hours)
 *   - designs uploaded (heroes updated with bracelet_design_created = true, last 14 days)
 */
export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sb = getServerClient();
    const cutoff14 = new Date(Date.now() - 14 * 86400000).toISOString();
    const cutoff48h = new Date(Date.now() - 48 * 3600000).toISOString();

    const [ordersRes, shippedRes, execRes] = await Promise.all([
      // Recent orders placed
      sb
        .from("orders")
        .select("id, order_number, order_type, billing_name, shipping_name, created_at")
        .gte("created_at", cutoff14)
        .order("created_at", { ascending: false })
        .limit(8),

      // Recent bracelets shipped
      sb
        .from("order_items")
        .select("id, lineitem_sku, updated_at, hero:heroes!hero_id(name), order:orders!order_id(order_number, billing_name)")
        .eq("production_status", "shipped")
        .gte("updated_at", cutoff14)
        .order("updated_at", { ascending: false })
        .limit(8),

      // Recent execution log (completed work)
      sb
        .from("execution_log")
        .select("id, title, item_type, domain, user_name, duration_minutes, completed_at")
        .gte("completed_at", cutoff48h)
        .order("completed_at", { ascending: false })
        .limit(10),
    ]);

    const events = [];

    for (const order of ordersRes.data || []) {
      const customerName = order.billing_name || order.shipping_name || "Customer";
      events.push({
        id: `order-${order.id}`,
        type: "order_placed",
        icon: "◈",
        label: order.order_type === "donated"
          ? `Donated order created — ${order.order_number || ""}`
          : `Order placed — ${order.order_number || ""} (${customerName})`,
        timestamp: order.created_at,
      });
    }

    for (const item of shippedRes.data || []) {
      const heroName = item.hero?.name || item.lineitem_sku || "bracelet";
      const customer = item.order?.billing_name || "";
      events.push({
        id: `shipped-${item.id}`,
        type: "shipped",
        icon: "↗",
        label: `Shipped — ${heroName}${customer ? ` → ${customer}` : ""}`,
        timestamp: item.updated_at,
      });
    }

    for (const entry of execRes.data || []) {
      const mins = entry.duration_minutes ? ` (${entry.duration_minutes}m)` : "";
      events.push({
        id: `exec-${entry.id}`,
        type: "work_completed",
        icon: "✓",
        label: `${entry.title || "Work logged"}${mins}`,
        domain: entry.domain,
        timestamp: entry.completed_at,
      });
    }

    // Sort all events newest-first and return top 10
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return NextResponse.json({ success: true, events: events.slice(0, 10) });
  } catch (err) {
    console.error("[recent-activity] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

function sizeFromSku(sku) {
  if (!sku) return "";
  if (/-6D?$/i.test(sku)) return "6";
  if (/-7D?$/i.test(sku)) return "7";
  return "";
}

/**
 * GET /api/orders/history
 *
 * Returns ORDERS as parent rows, each with nested line items.
 * Pagination is at the order level. One order can have many line items
 * (e.g. a customer buying bracelets for 3 different heroes = 1 order, 3 items).
 *
 * Query params:
 *   page       int   default 1
 *   limit      int   default 50, max 200
 *   search     str   order #, customer name, hero name, SKU
 *   status     str   production_status value, or "active" (not shipped/cancelled)
 *   type       str   order_type value (paid|donated|wholesale|gift|replacement)
 *   dateFrom   str   YYYY-MM-DD  (filters on orders.order_date)
 *   dateTo     str   YYYY-MM-DD
 *   sortBy     str   date|orderNumber|customer|total
 *   sortDir    str   asc|desc
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page     = Math.max(1, parseInt(searchParams.get("page")  || "1"));
    const limit    = Math.min(200, Math.max(5, parseInt(searchParams.get("limit") || "50")));
    const search   = (searchParams.get("search")   || "").trim();
    const status   = (searchParams.get("status")   || "").trim();
    const type     = (searchParams.get("type")     || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo   = (searchParams.get("dateTo")   || "").trim();
    const sortBy   = (searchParams.get("sortBy")   || "date").trim();
    const sortDir  = (searchParams.get("sortDir")  || "desc").trim();
    const offset   = (page - 1) * limit;

    const sb = getServerClient();

    // ── Step 1: Build the orders query with all AND-filters ─────────────────

    let orderCountQ = sb.from("orders").select("id", { count: "exact", head: true });
    let orderDataQ  = sb.from("orders").select(
      "id, order_number, order_type, order_date, billing_name, billing_email, " +
      "shipping_name, shipping_city, shipping_state, notes, source"
    );

    // type filter
    if (type) {
      orderCountQ = orderCountQ.eq("order_type", type);
      orderDataQ  = orderDataQ.eq("order_type",  type);
    }

    // date range
    if (dateFrom) {
      orderCountQ = orderCountQ.gte("order_date", dateFrom);
      orderDataQ  = orderDataQ.gte("order_date",  dateFrom);
    }
    if (dateTo) {
      orderCountQ = orderCountQ.lte("order_date", dateTo);
      orderDataQ  = orderDataQ.lte("order_date",  dateTo);
    }

    // ── Step 2: Search — orders matching text, then union with hero-matched orders ──
    if (search) {
      const like = `%${search}%`;

      // Find heroes whose names match
      const { data: heroMatches } = await sb
        .from("heroes")
        .select("id")
        .ilike("name", like)
        .limit(500);
      const heroIds = (heroMatches || []).map((h) => h.id);

      // Find order IDs via items that match hero or SKU
      const { data: itemMatches } = await sb
        .from("order_items")
        .select("order_id")
        .or([
          `lineitem_sku.ilike.${like}`,
          heroIds.length > 0 ? `hero_id.in.(${heroIds.slice(0, 200).join(",")})` : null,
        ].filter(Boolean).join(","))
        .limit(2000);
      const itemOrderIds = [...new Set((itemMatches || []).map((i) => i.order_id))];

      // Build OR filter on orders: order_number, billing_name, OR matched via items
      const orParts = [
        `order_number.ilike.${like}`,
        `billing_name.ilike.${like}`,
        `shipping_name.ilike.${like}`,
      ];
      if (itemOrderIds.length > 0) {
        orParts.push(`id.in.(${itemOrderIds.slice(0, 300).join(",")})`);
      }

      const orFilter = orParts.join(",");
      orderCountQ = orderCountQ.or(orFilter);
      orderDataQ  = orderDataQ.or(orFilter);
    }

    // ── Step 3: Sort + paginate the orders query ────────────────────────────
    const sortColMap = {
      date:        { col: "order_date",    asc: sortDir === "asc" },
      orderNumber: { col: "order_number",  asc: sortDir === "asc" },
      customer:    { col: "billing_name",  asc: sortDir === "asc" },
    };
    const sort = sortColMap[sortBy] || sortColMap.date;
    orderDataQ = orderDataQ
      .order(sort.col, { ascending: sort.asc, nullsLast: true })
      .range(offset, offset + limit - 1);

    // ── Step 4: Execute order queries ───────────────────────────────────────
    const [countResult, ordersResult] = await Promise.all([orderCountQ, orderDataQ]);
    if (countResult.error) throw countResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const total      = countResult.count || 0;
    const pages      = Math.ceil(total / limit);
    const orderList  = ordersResult.data || [];

    if (orderList.length === 0) {
      return NextResponse.json({ orders: [], total, pages, page });
    }

    // ── Step 5: Fetch all items for this page's orders ──────────────────────
    const orderIds = orderList.map((o) => o.id);

    let itemsQ = sb
      .from("order_items")
      .select(
        "id, order_id, lineitem_sku, quantity, unit_price, bracelet_size, production_status, " +
        "hero:heroes!hero_id(id, name)"
      )
      .in("order_id", orderIds);

    // If a status filter is set, only include items matching that status
    // (but still show the ORDER if at least one item matches — handled below)
    // For "active": exclude shipped/cancelled/delivered items from the item list
    if (status === "active") {
      itemsQ = itemsQ.not("production_status", "in", '("shipped","cancelled","delivered")');
    } else if (status) {
      itemsQ = itemsQ.eq("production_status", status);
    }

    const { data: itemData, error: itemError } = await itemsQ;
    if (itemError) throw itemError;

    // ── Step 6: Group items under their orders, compute order-level totals ──
    const itemsByOrder = new Map();
    for (const item of itemData || []) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      const sku  = item.lineitem_sku || "";
      itemsByOrder.get(item.order_id).push({
        id:               item.id,
        sku,
        heroName:         item.hero?.name || "",
        heroId:           item.hero?.id   || "",
        quantity:         item.quantity   || 1,
        unitPrice:        item.unit_price || 0,
        size:             sizeFromSku(sku) || item.bracelet_size || "",
        productionStatus: item.production_status || "",
      });
    }

    // STATUS_RANK: lower = earlier in pipeline (worse = drives the order badge)
    const STATUS_RANK = {
      not_started: 0, design_needed: 1, ready_to_laser: 2,
      in_production: 3, ready_to_ship: 4, shipped: 5,
      delivered: 6, cancelled: 7,
    };

    const orders = orderList
      .map((o) => {
        const items  = itemsByOrder.get(o.id) || [];

        // Skip orders with no matching items when a status filter is active
        if (status && items.length === 0) return null;

        const totalQty     = items.reduce((s, i) => s + i.quantity, 0);
        const totalRevenue = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

        // Worst (earliest pipeline) status drives the order badge
        const worstStatus = items.reduce((worst, item) => {
          const rank = STATUS_RANK[item.productionStatus] ?? 99;
          return rank < (STATUS_RANK[worst] ?? 99) ? item.productionStatus : worst;
        }, items[0]?.productionStatus || "");

        return {
          id:          o.id,
          orderNumber: o.order_number || "",
          orderType:   o.order_type   || "",
          orderDate:   o.order_date   || "",
          customerName:  o.billing_name   || o.shipping_name || "",
          customerEmail: o.billing_email  || "",
          shipTo:      [o.shipping_city, o.shipping_state].filter(Boolean).join(", "),
          notes:       o.notes || "",
          source:      o.source || "",
          itemCount:   items.length,
          totalQty,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          worstStatus,
          items,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ orders, total, pages, page });
  } catch (err) {
    console.error("History API error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

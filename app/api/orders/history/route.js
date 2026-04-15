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
 * Server-side paginated, filtered, sorted order history.
 * Handles 17k+ rows without loading everything into the browser.
 *
 * Query params:
 *   page         int   (default 1)
 *   limit        int   (default 50, max 200)
 *   search       str   (order #, customer name, hero name, SKU)
 *   status       str   (production_status enum value, or "active")
 *   type         str   (order_type enum value)
 *   dateFrom     str   YYYY-MM-DD
 *   dateTo       str   YYYY-MM-DD
 *   sortBy       str   date|orderNumber|hero|qty|price|status|type
 *   sortDir      str   asc|desc
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page     = Math.max(1, parseInt(searchParams.get("page")  || "1"));
    const limit    = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "50")));
    const search   = (searchParams.get("search")   || "").trim();
    const status   = (searchParams.get("status")   || "").trim();
    const type     = (searchParams.get("type")     || "").trim();
    const dateFrom = (searchParams.get("dateFrom") || "").trim();
    const dateTo   = (searchParams.get("dateTo")   || "").trim();
    const sortBy   = (searchParams.get("sortBy")   || "date").trim();
    const sortDir  = (searchParams.get("sortDir")  || "desc").trim();
    const offset   = (page - 1) * limit;

    const sb = getServerClient();

    // ── Step 1: Gather order_id constraints from structural filters ─────────
    // These are ANDed together. null = unconstrained.
    const orderIdSets = [];

    // order_type filter
    if (type) {
      const { data, error } = await sb
        .from("orders")
        .select("id")
        .eq("order_type", type)
        .limit(10000);
      if (error) throw error;
      orderIdSets.push(new Set((data || []).map((o) => o.id)));
    }

    // date range filter (uses order_date, not created_at)
    if (dateFrom || dateTo) {
      let q = sb.from("orders").select("id");
      if (dateFrom) q = q.gte("order_date", dateFrom);
      if (dateTo)   q = q.lte("order_date", dateTo);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      orderIdSets.push(new Set((data || []).map((o) => o.id)));
    }

    // Intersect all order constraints
    let validOrderIds = null; // null = no order-level constraints
    if (orderIdSets.length > 0) {
      validOrderIds = orderIdSets[0];
      for (let i = 1; i < orderIdSets.length; i++) {
        validOrderIds = new Set([...validOrderIds].filter((id) => orderIdSets[i].has(id)));
      }
      // Early exit if intersection is empty
      if (validOrderIds.size === 0) {
        return NextResponse.json({ items: [], total: 0, pages: 0, page: 1 });
      }
    }

    // ── Step 2: Search pre-queries ──────────────────────────────────────────
    // Search adds OR logic: order fields OR hero name OR SKU (handled in step 3).
    let searchOrderIds = null;
    let searchHeroIds  = null;

    if (search) {
      const like = `%${search}%`;
      const [orderRes, heroRes] = await Promise.all([
        sb
          .from("orders")
          .select("id")
          .or(`order_number.ilike.${like},billing_name.ilike.${like},shipping_name.ilike.${like}`)
          .limit(500),
        sb
          .from("heroes")
          .select("id")
          .ilike("name", like)
          .limit(500),
      ]);
      searchOrderIds = (orderRes.data || []).map((o) => o.id);
      searchHeroIds  = (heroRes.data  || []).map((h) => h.id);
    }

    // ── Step 3: Build main item query ───────────────────────────────────────
    const selectClause = `
      id, lineitem_sku, quantity, unit_price, bracelet_size, production_status, created_at,
      order:orders!order_id(
        id, order_number, order_type, order_date,
        billing_name, billing_email,
        shipping_name, shipping_city, shipping_state
      ),
      hero:heroes!hero_id(id, name)
    `;

    let countQ = sb.from("order_items").select("id", { count: "exact", head: true });
    let dataQ  = sb.from("order_items").select(selectClause);

    // Status filter
    if (status === "active") {
      // "active" = everything not shipped/cancelled
      countQ = countQ.not("production_status", "in", '("shipped","cancelled","delivered")');
      dataQ  = dataQ.not("production_status", "in", '("shipped","cancelled","delivered")');
    } else if (status) {
      countQ = countQ.eq("production_status", status);
      dataQ  = dataQ.eq("production_status", status);
    }

    // Order constraint from type + date filters
    if (validOrderIds !== null) {
      const ids = [...validOrderIds];
      countQ = countQ.in("order_id", ids);
      dataQ  = dataQ.in("order_id", ids);
    }

    // Search: OR across sku, matched order IDs, matched hero IDs
    if (search) {
      const like = `%${search}%`;
      const orParts = [`lineitem_sku.ilike.${like}`];

      if (searchOrderIds && searchOrderIds.length > 0) {
        const ids = searchOrderIds.slice(0, 300);
        orParts.push(`order_id.in.(${ids.join(",")})`);
      }
      if (searchHeroIds && searchHeroIds.length > 0) {
        const ids = searchHeroIds.slice(0, 300);
        orParts.push(`hero_id.in.(${ids.join(",")})`);
      }

      const orFilter = orParts.join(",");
      countQ = countQ.or(orFilter);
      dataQ  = dataQ.or(orFilter);
    }

    // Sort — only sort by direct order_items columns; everything else falls back to created_at
    const sortColMap = {
      date:     { col: "created_at",       asc: sortDir === "asc" },
      qty:      { col: "quantity",          asc: sortDir === "asc" },
      price:    { col: "unit_price",        asc: sortDir === "asc" },
      status:   { col: "production_status", asc: sortDir === "asc" },
      sku:      { col: "lineitem_sku",      asc: sortDir === "asc" },
    };
    const sort = sortColMap[sortBy] || sortColMap.date;
    dataQ = dataQ.order(sort.col, { ascending: sort.asc }).range(offset, offset + limit - 1);

    // ── Execute ──────────────────────────────────────────────────────────────
    const [countResult, dataResult] = await Promise.all([countQ, dataQ]);
    if (countResult.error) throw countResult.error;
    if (dataResult.error) throw dataResult.error;

    const total = countResult.count || 0;
    const pages = Math.ceil(total / limit);

    const items = (dataResult.data || []).map((r) => {
      const order = r.order || {};
      const hero  = r.hero  || {};
      const sku   = r.lineitem_sku || "";
      return {
        id:               r.id,
        sku,
        heroName:         hero.name || "",
        heroId:           hero.id   || "",
        quantity:         r.quantity || 1,
        unitPrice:        r.unit_price || 0,
        size:             sizeFromSku(sku) || r.bracelet_size || "",
        productionStatus: r.production_status || "",
        orderNumber:      order.order_number || "",
        orderType:        order.order_type   || "",
        orderDate:        order.order_date   || "",
        customerName:     order.billing_name || order.shipping_name || "",
        customerEmail:    order.billing_email || "",
        shipTo:           [order.shipping_city, order.shipping_state].filter(Boolean).join(", "),
        createdAt:        r.created_at || "",
      };
    });

    return NextResponse.json({ items, total, pages, page });
  } catch (err) {
    console.error("History API error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

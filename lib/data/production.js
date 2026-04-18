import { getServerClient } from "@/lib/supabase";
import { checkDesignInStorage } from "@/lib/design-storage";

const COLUMNS = ["not_started", "design_needed", "ready_to_laser", "in_production", "ready_to_ship"];

export async function getProductionBoard() {
  const sb = getServerClient();

  const { data: items, error } = await sb
    .from("order_items")
    .select(`
      id, lineitem_sku, quantity, bracelet_size, production_status, created_at,
      order:orders!order_id(
        id, order_number, order_date, order_type, billing_name, billing_email,
        shipping_name, shipping_address1, shipping_city, shipping_state, shipping_postal
      ),
      hero:heroes!hero_id(id, name, lineitem_sku, branch, on_hand_7in, on_hand_6in)
    `)
    .in("production_status", COLUMNS)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("Production board load error:", error.message);
    return { columns: {}, stats: {} };
  }

  const { data: shipped } = await sb
    .from("order_items")
    .select(`
      id, lineitem_sku, quantity, bracelet_size, production_status, created_at,
      order:orders!order_id(
        id, order_number, order_date, order_type, billing_name, billing_email,
        shipping_name, shipping_city, shipping_state
      ),
      hero:heroes!hero_id(id, name, lineitem_sku, branch)
    `)
    .eq("production_status", "shipped")
    .order("created_at", { ascending: false })
    .limit(10);

  const columns = {};
  for (const col of [...COLUMNS, "shipped"]) {
    columns[col] = [];
  }

  const allItems = [...(items || []), ...(shipped || [])];
  const designCache = new Map();

  for (const item of allItems) {
    const status = item.production_status;
    if (!columns[status]) continue;

    const sku = item.lineitem_sku || "";
    const hero = item.hero || {};
    const order = item.order || {};

    let hasDesign = false;
    if (sku && !designCache.has(sku)) {
      const check = await checkDesignInStorage(sku);
      designCache.set(sku, check.exists);
    }
    hasDesign = designCache.get(sku) || false;

    const size = extractSize(sku) || extractSizeFromField(item.bracelet_size);
    const hasAddress = !!(order.shipping_address1 && order.shipping_city);

    columns[status].push({
      itemId: item.id,
      sku,
      quantity: item.quantity || 1,
      size,
      status,
      orderId: order.id || null,
      orderNumber: order.order_number || "",
      orderDate: order.order_date || "",
      orderType: order.order_type || "",
      customerName: order.billing_name || order.shipping_name || "",
      billingEmail: order.billing_email || "",
      shippingName: order.shipping_name || order.billing_name || "",
      shippingAddress1: order.shipping_address1 || "",
      shippingCity: order.shipping_city || "",
      shippingState: order.shipping_state || "",
      shippingPostal: order.shipping_postal || "",
      hasAddress,
      heroId: hero.id || null,
      heroName: hero.name || "",
      branch: hero.branch || "",
      hasDesign,
      createdAt: item.created_at,
    });
  }

  // Group by SKU within each column
  const grouped = {};
  for (const [status, statusItems] of Object.entries(columns)) {
    const skuMap = new Map();
    for (const item of statusItems) {
      const key = item.sku;
      if (!skuMap.has(key)) {
        skuMap.set(key, {
          ...item,
          orderCount: 1,
          totalQty: item.quantity,
          allItemIds: [item.itemId],
          allOrderIds: item.orderId ? [item.orderId] : [],
          customers: item.customerName ? [item.customerName] : [],
          missingAddress: !item.hasAddress,
          // Keep first order's address for display
        });
      } else {
        const g = skuMap.get(key);
        g.orderCount++;
        g.totalQty += item.quantity;
        g.allItemIds.push(item.itemId);
        if (item.orderId && !g.allOrderIds.includes(item.orderId)) {
          g.allOrderIds.push(item.orderId);
        }
        if (item.customerName && !g.customers.includes(item.customerName)) {
          g.customers.push(item.customerName);
        }
        if (!item.hasAddress) g.missingAddress = true;
      }
    }
    grouped[status] = Array.from(skuMap.values());
  }

  const stats = {};
  for (const col of [...COLUMNS, "shipped"]) {
    stats[col] = (items || []).filter((i) => i.production_status === col).length;
  }

  const { count: totalShipped } = await sb
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("production_status", "shipped");
  stats.totalShipped = totalShipped || 0;

  return { columns: grouped, stats };
}

function extractSize(sku) {
  if (!sku) return null;
  const match = sku.match(/-([67])D?$/);
  return match ? match[1] : null;
}

function extractSizeFromField(field) {
  if (!field) return null;
  if (field.includes("7") || field === "Regular-7in") return "7";
  if (field.includes("6") || field === "Small-6in") return "6";
  return null;
}

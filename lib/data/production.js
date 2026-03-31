import { getServerClient } from "@/lib/supabase";
import { checkDesignInStorage } from "@/lib/design-storage";

const COLUMNS = ["design_needed", "ready_to_laser", "in_production", "ready_to_ship"];

/**
 * Get all active order items grouped by production status, then by SKU within each column.
 * Returns a structure ready for the Kanban board.
 */
export async function getProductionBoard() {
  const sb = getServerClient();

  // Fetch all non-shipped items
  const { data: items, error } = await sb
    .from("order_items")
    .select(`
      id, lineitem_sku, quantity, bracelet_size, production_status, created_at,
      order:orders!order_id(order_number, order_date, billing_name, order_type,
        shipping_name, shipping_city, shipping_state, billing_email),
      hero:heroes!hero_id(id, name, lineitem_sku, branch, on_hand_7in, on_hand_6in)
    `)
    .in("production_status", COLUMNS)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("Production board load error:", error.message);
    return { columns: {}, stats: {} };
  }

  // Also fetch recent shipped (last 10)
  const { data: shipped } = await sb
    .from("order_items")
    .select(`
      id, lineitem_sku, quantity, bracelet_size, production_status, created_at,
      order:orders!order_id(order_number, order_date, billing_name, order_type,
        shipping_name, shipping_city, shipping_state),
      hero:heroes!hero_id(id, name, lineitem_sku, branch)
    `)
    .eq("production_status", "shipped")
    .order("created_at", { ascending: false })
    .limit(10);

  // Group by status, then by SKU within each status
  const columns = {};
  for (const col of [...COLUMNS, "shipped"]) {
    columns[col] = [];
  }

  const allItems = [...(items || []), ...(shipped || [])];

  // Check designs for items in design_needed and not_started
  const designCache = new Map();

  for (const item of allItems) {
    const status = item.production_status;
    if (!columns[status]) continue;

    const sku = item.lineitem_sku || "";
    const hero = item.hero || {};
    const order = item.order || {};

    // Check design existence (cached per SKU)
    let hasDesign = false;
    if (sku && !designCache.has(sku)) {
      const check = await checkDesignInStorage(sku);
      designCache.set(sku, check.exists);
    }
    hasDesign = designCache.get(sku) || false;

    const size = extractSize(sku) || extractSizeFromField(item.bracelet_size);

    columns[status].push({
      itemId: item.id,
      sku,
      quantity: item.quantity || 1,
      size,
      status,
      orderNumber: order.order_number || "",
      orderDate: order.order_date || "",
      customerName: order.billing_name || order.shipping_name || "",
      orderType: order.order_type || "",
      heroId: hero.id || null,
      heroName: hero.name || "",
      branch: hero.branch || "",
      hasDesign,
      createdAt: item.created_at,
    });
  }

  // Deduplicate by SKU within each column
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
          customers: [item.customerName],
        });
      } else {
        const g = skuMap.get(key);
        g.orderCount++;
        g.totalQty += item.quantity;
        g.allItemIds.push(item.itemId);
        if (!g.customers.includes(item.customerName)) {
          g.customers.push(item.customerName);
        }
      }
    }
    grouped[status] = Array.from(skuMap.values());
  }

  // Stats
  const stats = {};
  for (const col of [...COLUMNS, "shipped"]) {
    stats[col] = (items || []).filter((i) => i.production_status === col).length;
  }
  stats.shipped = (shipped || []).length > 0 ? "10+" : "0";

  // Get total shipped count
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

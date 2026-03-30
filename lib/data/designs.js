import { getServerClient } from "@/lib/supabase";

/**
 * Get all heroes with active design tasks.
 * Uses valid Supabase enum values: not_started, research, in_progress, review, approved, complete
 */
export async function getDesignQueue() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("heroes")
      .select("*")
      .in("design_status", ["research", "in_progress", "review"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRecord);
  } catch (err) {
    console.error("Design queue load error:", err.message);
    return [];
  }
}

/**
 * Get order items that need designs — the real work queue.
 * Joins order_items → heroes to show what Ryan needs to make.
 */
export async function getOrderDesignQueue() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("order_items")
      .select(`
        id, lineitem_sku, quantity, bracelet_size, production_status,
        order:orders!order_id(order_number, order_date, billing_name, order_type),
        hero:heroes!hero_id(id, name, lineitem_sku, design_status, design_brief,
          bracelet_design_created, has_graphic_design, branch)
      `)
      .in("production_status", ["not_started", "design_needed"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map((item) => {
      const hero = item.hero || {};
      const order = item.order || {};
      const hasDesign = hero.bracelet_design_created || hero.has_graphic_design || false;
      return {
        itemId: item.id,
        sku: item.lineitem_sku || "",
        quantity: item.quantity || 1,
        size: item.bracelet_size || "",
        productionStatus: item.production_status,
        orderNumber: order.order_number || "",
        orderDate: order.order_date || "",
        customerName: order.billing_name || "",
        orderType: order.order_type || "",
        heroId: hero.id || null,
        heroName: hero.name || "",
        branch: hero.branch || "",
        designStatus: hero.design_status || "not_started",
        designBrief: hero.design_brief || "",
        hasDesign,
      };
    });
  } catch (err) {
    console.error("Order design queue error:", err.message);
    return [];
  }
}

/**
 * Get heroes that NEED design but haven't been queued yet.
 * These are heroes with no design flags set.
 */
export async function getNeedsDesign() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("heroes")
      .select("*")
      .eq("bracelet_design_created", false)
      .eq("has_graphic_design", false)
      .or("design_status.eq.not_started,design_status.is.null")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data || []).map(mapRecord);
  } catch (err) {
    console.error("Needs design load error:", err.message);
    return [];
  }
}

/**
 * Get design stats — uses valid Supabase enum values.
 */
export async function getDesignStats() {
  try {
    const sb = getServerClient();

    const countByStatus = async (status) => {
      const { count, error } = await sb
        .from("heroes")
        .select("id", { count: "exact", head: true })
        .eq("design_status", status);
      return error ? 0 : count;
    };

    const [research, inProgress, review, approved, complete] = await Promise.all([
      countByStatus("research"),
      countByStatus("in_progress"),
      countByStatus("review"),
      countByStatus("approved"),
      countByStatus("complete"),
    ]);

    // Order items needing design work
    const { count: orderItemsNeedDesign } = await sb
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .in("production_status", ["not_started", "design_needed"]);

    return {
      queued: research,
      inProgress,
      review,
      approved,
      complete,
      orderItemsNeedDesign: orderItemsNeedDesign || 0,
    };
  } catch (err) {
    console.error("Design stats error:", err.message);
    return { queued: 0, inProgress: 0, review: 0, approved: 0, complete: 0, orderItemsNeedDesign: 0 };
  }
}

function mapRecord(r) {
  return {
    id: r.sf_id || r.id,
    name: r.name,
    rank: r.rank || "",
    sku: r.lineitem_sku || "",
    branch: r.branch || "",
    memorialDate: r.memorial_date,
    designStatus: r.design_status || "not_started",
    designBrief: r.design_brief || "",
    designDueDate: r.design_due_date,
    hasDesign: r.bracelet_design_created || r.has_graphic_design || false,
    activeListing: r.active_listing || false,
    incident: r.incident || "",
    createdDate: r.created_at,
  };
}

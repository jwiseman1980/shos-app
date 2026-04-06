import { getServerClient } from "@/lib/supabase";
import { listOrders } from "@/lib/shipstation";
import { getDesignURL, uploadDesignSVG, getDriveClient } from "@/lib/gdrive";
import { checkDesignInStorage } from "@/lib/design-storage";

const DESIGNS_FOLDER_ID = process.env.GDRIVE_DESIGNS_FOLDER_ID || "";

/**
 * Strip size/variant suffixes to get base SKU.
 * e.g., USMA23-MORTON-7 -> USMA23-MORTON, USMA23-MORTON-7D -> USMA23-MORTON
 */
function toBaseSku(sku) {
  if (!sku) return "";
  return sku
    .replace(/-[67]D$/, "")
    .replace(/-[67]$/, "")
    .replace(/_-D$/, "")
    .replace(/-D$/, "");
}

/**
 * Extract size from a full SKU string.
 * e.g., USMA23-MORTON-7 -> "7", USMA23-MORTON-6D -> "6", USMA23-MORTON -> null
 */
function extractSize(sku) {
  if (!sku) return null;
  const match = sku.match(/-([67])D?$/);
  return match ? match[1] : null;
}

/**
 * Deep design check: looks for SVG files in 2 places before deciding a design is missing.
 *   1. Supabase hero record flags (bracelet_design_created, has_graphic_design)
 *   2. Google Drive designs folder ({SKU}.svg)
 *
 * SIZE-AWARE: When the SKU includes a size suffix (-6, -7, -6D, -7D), the check verifies
 * that a design for that SPECIFIC size exists. A 7" design does NOT satisfy a 6" order.
 *
 * Returns { hasDesign, heroId, designStatus, source } or null if no hero found.
 */
export async function checkDesignExists(sku) {
  if (!sku) return null;

  try {
    const baseSku = toBaseSku(sku);
    const size = extractSize(sku);
    if (!baseSku || baseSku === "DONATED") return null;

    const sb = getServerClient();

    // Step 1: Find the hero record
    const { data: heroes, error } = await sb
      .from("heroes")
      .select("id, sf_id, bracelet_design_created, has_graphic_design, design_status")
      .eq("lineitem_sku", baseSku)
      .limit(1);

    if (error) throw error;
    if (!heroes || heroes.length === 0) return null;

    const hero = heroes[0];
    const heroId = hero.sf_id || hero.id;
    const flagsSet = hero.bracelet_design_created === true || hero.has_graphic_design === true;

    // Step 1.5: Check Supabase Storage (canonical design store)
    try {
      const storageCheck = await checkDesignInStorage(sku);
      if (storageCheck.exists) {
        // Sync flags if not already set
        if (!flagsSet) {
          await sb
            .from("heroes")
            .update({
              bracelet_design_created: true,
              has_graphic_design: true,
              design_status: "Complete",
              design_brief: `Design in storage: ${storageCheck.url}`,
            })
            .eq("id", hero.id);
        }
        return {
          hasDesign: true,
          heroId,
          designStatus: "Complete",
          source: "storage",
        };
      }
    } catch (storageErr) {
      console.warn("Supabase Storage check failed:", storageErr.message);
    }

    // If flags say design exists BUT we need a specific size, verify the size file exists
    if (flagsSet && size) {
      try {
        const sizeResult = await getDesignURL(`${baseSku}-${size}`);
        if (sizeResult) {
          return {
            hasDesign: true,
            heroId,
            designStatus: hero.design_status || "Complete",
            source: "flags+size-verified",
          };
        }
        // Size-specific file not found -- design exists for hero but NOT for this size
        return {
          hasDesign: false,
          heroId,
          designStatus: "design_needed",
          source: "missing-size-variant",
          missingSize: size,
        };
      } catch (sizeErr) {
        console.warn("Size-specific design check failed:", sizeErr.message);
      }
    }

    // If flags say design exists and no specific size needed, trust that
    if (flagsSet) {
      return {
        hasDesign: true,
        heroId,
        designStatus: hero.design_status || "Complete",
        source: "flags",
      };
    }

    // Step 2: Check Google Drive
    try {
      const searchSku = size ? `${baseSku}-${size}` : baseSku;
      const driveResult = await getDesignURL(searchSku);
      if (driveResult) {
        // Found in Drive -- sync the Supabase flags
        await sb
          .from("heroes")
          .update({
            bracelet_design_created: true,
            has_graphic_design: true,
            design_status: "Complete",
            design_brief: `Design found in Drive: ${driveResult.webViewLink}`,
          })
          .eq("id", hero.id);

        return {
          hasDesign: true,
          heroId,
          designStatus: "Complete",
          source: "gdrive",
        };
      }

      // Also check Drive for misnamed files (partial SKU match)
      if (DESIGNS_FOLDER_ID) {
        const driveFixResult = await findAndFixDriveDesign(baseSku, hero.id);
        if (driveFixResult) {
          return {
            hasDesign: true,
            heroId,
            designStatus: "Complete",
            source: "gdrive-renamed",
          };
        }
      }
    } catch (driveErr) {
      console.warn("Drive design check failed:", driveErr.message);
    }

    // No design found anywhere
    return {
      hasDesign: false,
      heroId,
      designStatus: hero.design_status || "Not requested",
      source: "none",
    };
  } catch (err) {
    console.error("Design check error:", err.message);
    return null;
  }
}

/**
 * Search Google Drive for a misnamed SVG that should match this SKU.
 * If found, renames it to {baseSku}.svg so future lookups work.
 */
async function findAndFixDriveDesign(baseSku, heroDbId) {
  try {
    const parts = baseSku.split("-");
    if (parts.length < 2) return null;
    const lastName = parts[parts.length - 1];
    if (!lastName || lastName.length < 3) return null;

    const drive = await getDriveClient();
    const res = await drive.files.list({
      q: `'${DESIGNS_FOLDER_ID}' in parents and trashed = false and mimeType = 'image/svg+xml' and name contains '${lastName}'`,
      fields: "files(id, name, webViewLink)",
      pageSize: 5,
    });

    const files = res.data.files || [];
    if (files.length === 0) return null;

    const file = files[0];
    const correctName = `${baseSku}.svg`;

    if (file.name !== correctName) {
      console.log(`Renaming Drive SVG: "${file.name}" -> "${correctName}"`);
      await drive.files.update({
        fileId: file.id,
        requestBody: { name: correctName },
      });
    }

    // Update Supabase flags
    const sb = getServerClient();
    await sb
      .from("heroes")
      .update({
        bracelet_design_created: true,
        has_graphic_design: true,
        design_status: "Complete",
        design_brief: `Design found in Drive (renamed): ${file.webViewLink}`,
      })
      .eq("id", heroDbId);

    return { fileId: file.id, fileName: correctName };
  } catch (err) {
    console.warn("Drive rename search failed:", err.message);
    return null;
  }
}

/**
 * Check if a hero has burnout stock (pre-made bracelets) for a given size.
 * Returns the on-hand count for the requested size, or total if no size specified.
 */
async function checkBurnoutStock(sku) {
  if (!sku) return null;
  const baseSku = toBaseSku(sku);
  const size = extractSize(sku);
  if (!baseSku || baseSku === "DONATED") return null;

  const sb = getServerClient();
  const { data: heroes, error } = await sb
    .from("heroes")
    .select("id, sf_id, name, on_hand_7in, on_hand_6in, total_on_hand")
    .eq("lineitem_sku", baseSku)
    .limit(1);

  if (error || !heroes || heroes.length === 0) return null;
  const hero = heroes[0];

  const stock7 = hero.on_hand_7in || 0;
  const stock6 = hero.on_hand_6in || 0;
  const relevantStock = size === "6" ? stock6 : size === "7" ? stock7 : (stock7 + stock6);

  return {
    hasStock: relevantStock > 0,
    heroId: hero.sf_id || hero.id,
    heroDbId: hero.id,
    heroName: hero.name,
    stockCount: relevantStock,
    stock7: stock7,
    stock6: stock6,
    size,
  };
}

/**
 * Decrement burnout stock for a hero after fulfilling from inventory.
 * Decrements the size-specific on_hand field.
 */
async function decrementBurnoutStock(heroDbId, size, quantity = 1) {
  const sb = getServerClient();
  const { data: hero } = await sb
    .from("heroes")
    .select("on_hand_7in, on_hand_6in")
    .eq("id", heroDbId)
    .single();

  if (!hero) return false;

  const field = size === "6" ? "on_hand_6in" : "on_hand_7in";
  const current = size === "6" ? (hero.on_hand_6in || 0) : (hero.on_hand_7in || 0);
  const newValue = Math.max(0, current - quantity);

  const { error } = await sb
    .from("heroes")
    .update({ [field]: newValue })
    .eq("id", heroDbId);

  if (error) {
    console.error("Burnout stock decrement failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Triage all "not_started" order items using three-path logic:
 * 1. Design exists → advance to "ready_to_laser" (Joseph lasers it)
 * 2. No design but burnout stock exists → advance to "ready_to_ship" (pull from shelf)
 * 3. No design and no stock → set to "design_needed" (Ryan creates design)
 */
export async function triageNeedsDecision() {
  try {
    const sb = getServerClient();
    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        id, lineitem_sku, hero_id, quantity,
        heroes:hero_id(name, has_graphic_design, bracelet_design_created)
      `)
      .eq("production_status", "not_started")
      .limit(100);

    if (error) throw error;
    if (!items || items.length === 0) return { advanced: 0, fromStock: 0, needsDesign: 0, skipped: 0, errors: [], results: [] };

    let advanced = 0;
    let fromStock = 0;
    let needsDesign = 0;
    let skipped = 0;
    const errors = [];
    const results = [];

    for (const item of items) {
      const sku = item.lineitem_sku || "";
      const label = item.heroes?.name || sku || item.id;
      const designCheck = await checkDesignExists(sku);

      if (designCheck === null) {
        skipped++;
        results.push({ id: item.id, name: label, action: "skipped", reason: "No hero found for SKU" });
        continue;
      }

      // Path 1: Design exists → ready to laser
      if (designCheck.hasDesign) {
        try {
          const updateFields = { production_status: "ready_to_laser" };
          if (!item.hero_id) updateFields.hero_id = designCheck.heroId;
          const { error: updateErr } = await sb
            .from("order_items")
            .update(updateFields)
            .eq("id", item.id);
          if (updateErr) throw updateErr;
          advanced++;
          results.push({
            id: item.id, name: label, action: "advanced",
            newStatus: "ready_to_laser", source: designCheck.source,
          });
        } catch (e) {
          errors.push({ id: item.id, name: label, error: e.message });
        }
        continue;
      }

      // Path 2: No design, but burnout stock covers the full order qty → ready to ship
      const stockCheck = await checkBurnoutStock(sku);
      const qty = item.quantity || 1;
      if (stockCheck?.hasStock && stockCheck.stockCount >= qty) {
        try {
          const updateFields = { production_status: "ready_to_ship" };
          if (!item.hero_id) updateFields.hero_id = stockCheck.heroId;
          const { error: updateErr } = await sb
            .from("order_items")
            .update(updateFields)
            .eq("id", item.id);
          if (updateErr) throw updateErr;

          // Decrement the burnout stock
          await decrementBurnoutStock(stockCheck.heroDbId, stockCheck.size, qty);

          fromStock++;
          results.push({
            id: item.id, name: label, action: "fromStock",
            newStatus: "ready_to_ship",
            stockBefore: stockCheck.stockCount,
            stockAfter: Math.max(0, stockCheck.stockCount - qty),
          });
        } catch (e) {
          errors.push({ id: item.id, name: label, error: e.message });
        }
        continue;
      }

      // Path 3: No design and no stock → design needed
      try {
        const updateFields = { production_status: "design_needed" };
        if (!item.hero_id) updateFields.hero_id = designCheck.heroId;
        const { error: updateErr } = await sb
          .from("order_items")
          .update(updateFields)
          .eq("id", item.id);
        if (updateErr) throw updateErr;
        needsDesign++;
        results.push({ id: item.id, name: label, action: "needsDesign", newStatus: "design_needed" });
      } catch (e) {
        errors.push({ id: item.id, name: label, error: e.message });
      }
    }

    return { advanced, fromStock, needsDesign, skipped, errors, results };
  } catch (err) {
    console.error("Triage error:", err.message);
    return { advanced: 0, fromStock: 0, needsDesign: 0, skipped: 0, errors: [{ error: err.message }] };
  }
}

/**
 * Get all active order line items with parent order info
 */
export async function getActiveOrderItems() {
  try {
    const sb = getServerClient();
    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        *,
        order:orders!order_id(*),
        hero:heroes!hero_id(name, has_graphic_design, bracelet_design_created, design_brief)
      `)
      .not("production_status", "is", null)
      .neq("production_status", "shipped")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return (items || []).map(mapLineItem);
  } catch (err) {
    console.error("Order items load error:", err.message);
    return [];
  }
}

/**
 * Get line items by production status
 */
export async function getItemsByStatus(status) {
  try {
    const sb = getServerClient();
    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        *,
        order:orders!order_id(*),
        hero:heroes!hero_id(name, has_graphic_design, bracelet_design_created, design_brief)
      `)
      .eq("production_status", status)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return (items || []).map(mapLineItem);
  } catch (err) {
    console.error(`Order items by status [${status}] error:`, err.message);
    return [];
  }
}

/**
 * Get order stats
 */
export async function getOrderStats() {
  try {
    const sb = getServerClient();

    // Supabase enum values (only these are valid):
    const statuses = ["not_started", "design_needed", "ready_to_laser", "in_production", "ready_to_ship", "shipped"];
    const counts = {};
    for (const s of statuses) {
      const { count, error } = await sb
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("production_status", s);
      counts[s] = error ? 0 : count;
    }

    const { count: totalPaid } = await sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_type", "paid");

    const { count: totalDonated } = await sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("order_type", "donated");

    const dn = (counts["not_started"] || 0) + (counts["design_needed"] || 0);
    const rtl = counts["ready_to_laser"] || 0;
    const ip = counts["in_production"] || 0;
    const rts = counts["ready_to_ship"] || 0;

    return {
      designNeeded: dn,
      designInProgress: 0,
      readyToLaser: rtl,
      inProduction: ip,
      readyToShip: rts,
      shipped: counts["shipped"] || 0,
      totalActive: dn + rtl + ip + rts,
      totalPaid: totalPaid || 0,
      totalDonated: totalDonated || 0,
    };
  } catch (err) {
    console.error("Order stats error:", err.message);
    return { designNeeded: 0, designInProgress: 0, readyToLaser: 0, inProduction: 0, readyToShip: 0, shipped: 0, totalActive: 0, totalPaid: 0, totalDonated: 0 };
  }
}

/**
 * Get donated bracelet KPI stats (monthly, yearly, all-time)
 */
export async function getDonatedStats() {
  try {
    const sb = getServerClient();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const yearStart = `${now.getFullYear()}-01-01`;

    // Items from donated orders
    const baseQuery = () => sb
      .from("order_items")
      .select("id, quantity, order:orders!order_id(order_type, created_at)", { count: "exact" })
      .eq("order.order_type", "donated");

    // All-time: sum quantities
    const { data: allItems } = await sb
      .from("order_items")
      .select("quantity, order:orders!order_id(order_type, created_at)")
      .eq("order.order_type", "donated");

    const allTime = (allItems || []).reduce((sum, i) => sum + (i.quantity || 1), 0);

    const thisYear = (allItems || [])
      .filter((i) => i.order?.created_at >= yearStart)
      .reduce((sum, i) => sum + (i.quantity || 1), 0);

    const thisMonth = (allItems || [])
      .filter((i) => i.order?.created_at >= monthStart)
      .reduce((sum, i) => sum + (i.quantity || 1), 0);

    return { thisMonth, thisYear, allTime };
  } catch (err) {
    console.error("Donated stats error:", err.message);
    return { thisMonth: 0, thisYear: 0, allTime: 0 };
  }
}

/**
 * Get charity funds raised KPI (monthly, yearly, all-time)
 * Each paid bracelet at $35+ generates a $10 charity obligation
 */
export async function getCharityStats() {
  try {
    const sb = getServerClient();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const yearStart = `${now.getFullYear()}-01-01`;

    const { data: items } = await sb
      .from("order_items")
      .select("quantity, unit_price, order:orders!order_id(order_type, order_date)")
      .eq("order.order_type", "paid")
      .gte("unit_price", 35);

    const obligationPerBracelet = 10;
    const calc = (filtered) =>
      (filtered || []).reduce((sum, i) => sum + (i.quantity || 1) * obligationPerBracelet, 0);

    const allTime = calc(items);
    const thisYear = calc((items || []).filter((i) => i.order?.order_date >= yearStart));
    const thisMonth = calc((items || []).filter((i) => i.order?.order_date >= monthStart));

    return { thisMonth, thisYear, allTime };
  } catch (err) {
    console.error("Charity stats error:", err.message);
    return { thisMonth: 0, thisYear: 0, allTime: 0 };
  }
}

/**
 * Create a donated order in Supabase
 */
export async function createDonatedOrder({
  heroName,
  recipientName,
  recipientEmail = "",
  quantity = 1,
  quantity6 = 0,
  quantity7 = 0,
  source = "Email",
  notes = "",
  fulfillmentMethod = "Design + Laser",
  sku = "",
  shippingName = "",
  shippingAddress1 = "",
  shippingCity = "",
  shippingState = "",
  shippingPostal = "",
  shippingCountry = "US",
}) {
  try {
    const sb = getServerClient();
    const orderName = `DON-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const orderFields = {
      order_number: orderName,
      order_type: "donated",
      order_date: new Date().toISOString().slice(0, 10),
      billing_name: recipientName,
      billing_email: recipientEmail,
      notes: `Source: ${source}. ${notes}`.trim(),
    };

    if (shippingName || shippingAddress1) {
      orderFields.shipping_name = shippingName || recipientName;
      orderFields.shipping_address1 = shippingAddress1;
      orderFields.shipping_city = shippingCity;
      orderFields.shipping_state = shippingState;
      orderFields.shipping_postal = shippingPostal;
      orderFields.shipping_country = shippingCountry;
    }

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert(orderFields)
      .select("id")
      .single();

    if (orderErr) throw orderErr;

    const baseSku = sku || "DONATED";
    const itemIds = [];
    let anyAdvanced = false;
    let lastStatus = "design_needed";

    const sizes = [];
    const q7 = quantity7 || (quantity6 === 0 ? (quantity || 1) : 0);
    const q6 = quantity6 || 0;
    if (q7 > 0) sizes.push({ qty: q7, size: "Regular-7in", suffix: "-7" });
    if (q6 > 0) sizes.push({ qty: q6, size: "Small-6in", suffix: "-6" });

    for (const { qty, size, suffix } of sizes) {
      const itemSku = baseSku === "DONATED" ? "DONATED" : `${baseSku}${suffix}`;
      const designCheck = itemSku !== "DONATED" ? await checkDesignExists(itemSku) : null;
      const hasDesign = designCheck?.hasDesign === true;

      // Three-path: design → laser, burnout stock → ship, neither → design needed
      let initialStatus = "design_needed";
      let fulfilledFromStock = false;
      if (hasDesign) {
        initialStatus = "ready_to_laser";
      } else if (itemSku !== "DONATED") {
        const stockCheck = await checkBurnoutStock(itemSku);
        if (stockCheck?.hasStock && stockCheck.stockCount >= qty) {
          initialStatus = "ready_to_ship";
          fulfilledFromStock = true;
          await decrementBurnoutStock(stockCheck.heroDbId, stockCheck.size, qty);
        }
      }

      const itemFields = {
        order_id: order.id,
        lineitem_sku: itemSku,
        quantity: qty,
        unit_price: 0,
        bracelet_size: size,
        production_status: initialStatus,
      };

      if (designCheck?.heroId) {
        itemFields.hero_id = designCheck.heroId;
      }

      const { data: item, error: itemErr } = await sb
        .from("order_items")
        .insert(itemFields)
        .select("id")
        .single();

      if (itemErr) throw itemErr;
      itemIds.push(item.id);
      if (hasDesign) anyAdvanced = true;
      if (fulfilledFromStock) anyAdvanced = true;
      lastStatus = initialStatus;
    }

    return {
      success: true,
      orderId: order.id,
      itemIds,
      orderName,
      autoAdvanced: anyAdvanced,
      initialStatus: lastStatus,
    };
  } catch (err) {
    console.error("Create donated order error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update a line item's production status
 */
export async function updateItemStatus(itemId, newStatus) {
  try {
    const sb = getServerClient();
    const { error } = await sb
      .from("order_items")
      .update({ production_status: newStatus })
      .eq("id", itemId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Update item status error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Auto-reconcile order items with ShipStation shipped orders.
 */
export async function reconcileWithShipStation() {
  try {
    const sb = getServerClient();

    // Get items not yet shipped
    const { data: sbItems, error } = await sb
      .from("order_items")
      .select("id, lineitem_sku, order:orders!order_id(order_number)")
      .not("production_status", "is", null)
      .neq("production_status", "shipped")
      .limit(200);

    if (error) throw error;
    if (!sbItems || sbItems.length === 0) return { updated: 0, remaining: 0 };

    // Get all shipped orders from ShipStation (paginated)
    let ssShipped = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 20) {
      const res = await listOrders({ orderStatus: "shipped", page, pageSize: 500 });
      const orders = res?.orders || [];
      ssShipped = ssShipped.concat(orders);
      hasMore = orders.length === 500;
      page++;
    }
    const ssOrderNumbers = new Set(ssShipped.map((o) => o.orderNumber));

    let updated = 0;
    for (const item of sbItems) {
      const orderNum = item.order?.order_number;
      const isShippedInSS = orderNum && ssOrderNumbers.has(orderNum);

      if (isShippedInSS) {
        await sb
          .from("order_items")
          .update({ production_status: "shipped" })
          .eq("id", item.id);
        updated++;
      }
    }

    return { updated, remaining: sbItems.length - updated };
  } catch (err) {
    console.error("Reconciliation error:", err.message);
    return { updated: 0, remaining: 0, error: err.message };
  }
}

/**
 * Get active orders grouped with their items
 */
export async function getGroupedOrders() {
  try {
    const sb = getServerClient();
    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        *,
        order:orders!order_id(*),
        hero:heroes!hero_id(name, has_graphic_design, bracelet_design_created, design_brief)
      `)
      .not("production_status", "is", null)
      .neq("production_status", "shipped")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    // Group by parent order
    const orderMap = new Map();
    for (const item of (items || [])) {
      const orderId = item.order_id;
      const order = item.order || {};
      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          id: orderId,
          name: order.order_number || "",
          orderNumber: order.order_number || "",
          orderType: order.order_type || "",
          customerName: order.billing_name || order.shipping_name || "",
          shipTo: [order.shipping_city, order.shipping_state].filter(Boolean).join(", "),
          customerEmail: order.billing_email || "",
          orderDate: order.order_date || "",
          items: [],
        });
      }
      const itemSku = item.lineitem_sku || "";
      const hasDesign = item.hero?.has_graphic_design || item.hero?.bracelet_design_created || false;
      const heroName = item.hero?.name || "";
      orderMap.get(orderId).items.push({
        id: item.id,
        name: heroName || itemSku || "Unknown",
        sku: itemSku,
        quantity: item.quantity || 1,
        unitPrice: item.unit_price || 0,
        size: item.bracelet_size || "",
        productionStatus: item.production_status || "design_needed",
        hasDesign,
        designUrl: hasDesign && itemSku ? `/api/designs/download?sku=${encodeURIComponent(itemSku)}` : "",
      });
    }

    return Array.from(orderMap.values());
  } catch (err) {
    console.error("Grouped orders error:", err.message);
    return [];
  }
}

function sizeFromSku(sku) {
  if (!sku) return "";
  if (/-6D?$/i.test(sku)) return "6";
  if (/-7D?$/i.test(sku)) return "7";
  return "";
}

function mapLineItem(r) {
  const order = r.order || {};
  const hero = r.hero || {};
  const sku = r.lineitem_sku || "";
  return {
    id: r.id,
    sku,
    heroName: hero.name || "",
    quantity: r.quantity || 1,
    unitPrice: r.unit_price || 0,
    size: sizeFromSku(sku) || r.bracelet_size || "",
    productionStatus: r.production_status || "design_needed",
    heroId: r.hero_id || "",
    orderNumber: order.order_number || "",
    orderType: order.order_type || "",
    customerName: order.billing_name || order.shipping_name || "",
    shipTo: [order.shipping_city, order.shipping_state].filter(Boolean).join(", ") || "",
    customerEmail: order.billing_email || "",
    orderDate: order.order_date || "",
    hasDesign: hero.has_graphic_design || hero.bracelet_design_created || false,
    designUrl: (() => {
      const hasFile = hero.has_graphic_design || hero.bracelet_design_created;
      if (sku && hasFile) return `/api/designs/download?sku=${encodeURIComponent(sku)}`;
      const is6in = /-6D?$/i.test(sku);
      const brief = is6in
        ? (hero.design_brief || "")
        : (hero.design_brief || "");
      return brief.match(/https:\/\/[^\s]+/)?.[0] || "";
    })(),
  };
}

// ---------------------------------------------------------------------------
// Monthly Report Queries
// ---------------------------------------------------------------------------

/**
 * Get all paid bracelet order items for a specific month.
 */
export async function getOrdersByMonth(month, year) {
  try {
    const sb = getServerClient();
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01T05:00:00.000Z`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01T05:00:00.000Z`;

    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        *,
        hero:heroes!hero_id(name, organization:organizations!organization_id(id, name)),
        order:orders!order_id(order_number, order_date, order_type, billing_name, billing_email)
      `)
      .gte("order.order_date", startDate)
      .lt("order.order_date", endDate)
      .eq("order.order_type", "paid")
      .order("order(order_date)", { ascending: true });

    if (error) throw error;

    return (items || []).map((r) => {
      const sku = r.lineitem_sku || "";
      const unitPrice = r.unit_price || 0;
      const qty = r.quantity || 1;
      const isDVar = sku.toUpperCase().endsWith("-7D") || sku.toUpperCase().endsWith("-6D") || unitPrice === 45;
      const isBracelet = sku.length > 0;
      const generatesObligation = unitPrice === 35 || unitPrice === 45;
      const org = r.hero?.organization;

      return {
        id: r.id,
        orderDate: r.order?.order_date || "",
        orderNumber: r.order?.order_number || "",
        customerName: r.order?.billing_name || "",
        sku,
        heroName: r.hero?.name || "",
        size: sizeFromSku(sku) || r.bracelet_size || "",
        quantity: qty,
        unitPrice,
        lineTotal: Math.round(unitPrice * qty * 100) / 100,
        isDVariant: isDVar,
        isBracelet,
        generatesObligation,
        designatedOrg: org?.name || "",
        designatedOrgId: org?.id || "",
        obligationAmount: generatesObligation ? qty * 10 : 0,
        shDonation: isDVar ? qty * 10 : 0,
      };
    });
  } catch (err) {
    console.error("getOrdersByMonth error:", err.message);
    return [];
  }
}

/**
 * Get donated bracelet orders for a specific month.
 */
export async function getDonatedOrdersByMonth(month, year) {
  try {
    const sb = getServerClient();
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01T05:00:00.000Z`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01T05:00:00.000Z`;

    const { data: items, error } = await sb
      .from("order_items")
      .select(`
        *,
        hero:heroes!hero_id(name),
        order:orders!order_id(order_number, order_date, order_type, shipping_name, shipping_city, shipping_state)
      `)
      .gte("order.order_date", startDate)
      .lt("order.order_date", endDate)
      .eq("order.order_type", "donated")
      .order("order(order_date)", { ascending: true });

    if (error) throw error;

    return (items || []).map((r) => ({
      id: r.id,
      orderDate: r.order?.order_date || "",
      orderNumber: r.order?.order_number || "",
      heroName: r.hero?.name || "",
      sku: r.lineitem_sku || "",
      size: sizeFromSku(r.lineitem_sku) || r.bracelet_size || "",
      quantity: r.quantity || 1,
      unitCost: r.unit_price || 0,
      totalCost: (r.quantity || 1) * (r.unit_price || 0),
      recipient: r.order?.shipping_name || "",
      recipientLocation: [
        r.order?.shipping_city,
        r.order?.shipping_state,
      ].filter(Boolean).join(", "),
    }));
  } catch (err) {
    console.error("getDonatedOrdersByMonth error:", err.message);
    return [];
  }
}

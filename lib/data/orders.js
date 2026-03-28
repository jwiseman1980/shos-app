import { sfQuery, sfCreate, sfUpdate } from "@/lib/salesforce";
import { listOrders } from "@/lib/shipstation";
import { getDesignURL, uploadDesignSVG, getDriveClient } from "@/lib/gdrive";

const SF_LIVE = process.env.SF_LIVE === "true";
const DESIGNS_FOLDER_ID = process.env.GDRIVE_DESIGNS_FOLDER_ID || "";

/**
 * Strip size/variant suffixes to get base SKU.
 * e.g., USMA23-MORTON-7 → USMA23-MORTON, USMA23-MORTON-7D → USMA23-MORTON
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
 * e.g., USMA23-MORTON-7 → "7", USMA23-MORTON-6D → "6", USMA23-MORTON → null
 */
function extractSize(sku) {
  if (!sku) return null;
  const match = sku.match(/-([67])D?$/);
  return match ? match[1] : null;
}

/**
 * Deep design check: looks for SVG files in 3 places before deciding a design is missing.
 *   1. SF record flags (Bracelet_Design_Created__c, Has_Graphic_Design__c)
 *   2. SF ContentDocumentLink (SVG attached to the hero record)
 *   3. Google Drive designs folder ({SKU}.svg)
 *
 * SIZE-AWARE: When the SKU includes a size suffix (-6, -7, -6D, -7D), the check verifies
 * that a design for that SPECIFIC size exists. A 7" design does NOT satisfy a 6" order.
 *
 * If a file is found but named wrong, renames it to match the SKU.
 * If a file is in Drive but not in SF (or vice-versa), syncs the flag.
 *
 * Returns { hasDesign, heroId, designStatus, source } or null if no hero found.
 */
export async function checkDesignExists(sku) {
  if (!SF_LIVE || !sku) return null;

  try {
    const baseSku = toBaseSku(sku);
    const size = extractSize(sku); // "6", "7", or null
    if (!baseSku || baseSku === "DONATED") return null;

    // Step 1: Find the hero record
    const heroes = await sfQuery(
      `SELECT Id, Bracelet_Design_Created__c, Has_Graphic_Design__c, Design_Status__c
       FROM Memorial_Bracelet__c
       WHERE Lineitem_sku__c = '${baseSku}'
       LIMIT 1`
    );
    if (heroes.length === 0) return null;

    const hero = heroes[0];
    const flagsSet =
      hero.Bracelet_Design_Created__c === true ||
      hero.Has_Graphic_Design__c === true;

    // If flags say design exists BUT we need a specific size, verify the size file exists
    // (flags are hero-level, not size-level — a 7" design may exist but not 6")
    if (flagsSet && size) {
      // Check Drive for size-specific file before trusting flags
      try {
        const sizeResult = await getDesignURL(`${baseSku}-${size}`);
        if (sizeResult) {
          return {
            hasDesign: true,
            heroId: hero.Id,
            designStatus: hero.Design_Status__c || "Complete",
            source: "sf-flags+size-verified",
          };
        }
        // Size-specific file not found — also check SF ContentDocumentLink
        const files = await sfQuery(
          `SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileType
           FROM ContentDocumentLink
           WHERE LinkedEntityId = '${hero.Id}'`
        );
        const svgs = files.filter(
          (f) => f.ContentDocument?.FileType?.toUpperCase() === "SVG"
        );
        const sizeMatch = svgs.find((f) => {
          const title = (f.ContentDocument?.Title || "").toUpperCase();
          return title.includes(`-${size}`) || title.includes(`_${size}`);
        });
        if (sizeMatch) {
          return {
            hasDesign: true,
            heroId: hero.Id,
            designStatus: hero.Design_Status__c || "Complete",
            source: "sf-content-size-match",
          };
        }
        // Design exists for hero but NOT for this size — needs size variant created
        return {
          hasDesign: false,
          heroId: hero.Id,
          designStatus: "Design Needed",
          source: "missing-size-variant",
          missingSize: size,
        };
      } catch (sizeErr) {
        console.warn("Size-specific design check failed:", sizeErr.message);
        // Fall through to trust flags if size check fails
      }
    }

    // If flags say design exists and no specific size needed, trust that
    if (flagsSet) {
      return {
        hasDesign: true,
        heroId: hero.Id,
        designStatus: hero.Design_Status__c || "Complete",
        source: "sf-flags",
      };
    }

    // Step 2: Check SF ContentDocumentLink for SVG files on the hero
    try {
      const files = await sfQuery(
        `SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileType
         FROM ContentDocumentLink
         WHERE LinkedEntityId = '${hero.Id}'`
      );
      const svgs = files.filter(
        (f) => f.ContentDocument?.FileType?.toUpperCase() === "SVG"
      );
      if (svgs.length > 0) {
        // If size-specific check needed, verify file matches
        if (size) {
          const sizeMatch = svgs.find((f) => {
            const title = (f.ContentDocument?.Title || "").toUpperCase();
            return title.includes(`-${size}`) || title.includes(`_${size}`);
          });
          if (!sizeMatch) {
            // SVG exists but wrong size
            return {
              hasDesign: false,
              heroId: hero.Id,
              designStatus: "Design Needed",
              source: "missing-size-variant",
              missingSize: size,
            };
          }
        }

        // Sync flags on the hero record since we found an SVG
        await sfUpdate("Memorial_Bracelet__c", hero.Id, {
          Bracelet_Design_Created__c: true,
          Has_Graphic_Design__c: true,
          Design_Status__c: "Complete",
        });

        return {
          hasDesign: true,
          heroId: hero.Id,
          designStatus: "Complete",
          source: "sf-content",
        };
      }
    } catch (sfErr) {
      console.warn("SF ContentDocument check failed:", sfErr.message);
    }

    // Step 3: Check Google Drive — size-specific first if size is known
    try {
      const searchSku = size ? `${baseSku}-${size}` : baseSku;
      const driveResult = await getDesignURL(searchSku);
      if (driveResult) {
        // Found in Drive — sync the SF flags
        await sfUpdate("Memorial_Bracelet__c", hero.Id, {
          Bracelet_Design_Created__c: true,
          Has_Graphic_Design__c: true,
          Design_Status__c: "Complete",
          Design_Brief__c: `Design found in Drive: ${driveResult.webViewLink}`,
        });

        return {
          hasDesign: true,
          heroId: hero.Id,
          designStatus: "Complete",
          source: "gdrive",
        };
      }

      // Also check Drive for misnamed files (partial SKU match)
      if (DESIGNS_FOLDER_ID) {
        const driveFixResult = await findAndFixDriveDesign(baseSku, hero.Id);
        if (driveFixResult) {
          return {
            hasDesign: true,
            heroId: hero.Id,
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
      heroId: hero.Id,
      designStatus: hero.Design_Status__c || "Not requested",
      source: "none",
    };
  } catch (err) {
    console.error("Design check error:", err.message);
    return null;
  }
}

/**
 * Search Google Drive for a misnamed SVG that should match this SKU.
 * Looks for files containing the last name from the SKU (e.g., "MORTON" from "USMA23-MORTON").
 * If found, renames it to {baseSku}.svg so future lookups work.
 */
async function findAndFixDriveDesign(baseSku, heroId) {
  try {
    // Extract the last name portion (e.g., "MORTON" from "USMA23-MORTON")
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

    // Found a file with the last name — rename it to the correct SKU
    const file = files[0];
    const correctName = `${baseSku}.svg`;

    if (file.name !== correctName) {
      console.log(`Renaming Drive SVG: "${file.name}" → "${correctName}"`);
      await drive.files.update({
        fileId: file.id,
        requestBody: { name: correctName },
      });
    }

    // Update SF flags
    await sfUpdate("Memorial_Bracelet__c", heroId, {
      Bracelet_Design_Created__c: true,
      Has_Graphic_Design__c: true,
      Design_Status__c: "Complete",
      Design_Brief__c: `Design found in Drive (renamed): ${file.webViewLink}`,
    });

    return { fileId: file.id, fileName: correctName };
  } catch (err) {
    console.warn("Drive rename search failed:", err.message);
    return null;
  }
}

/**
 * Triage all "Needs Decision" order items:
 * - Items with existing designs → advance to "Ready to Laser"
 * - Items without designs → set to "Design Needed"
 * Returns { advanced, needsDesign, skipped, errors }
 */
export async function triageNeedsDecision() {
  if (!SF_LIVE) return { advanced: 0, needsDesign: 0, skipped: 0, errors: [] };

  try {
    const items = await sfQuery(
      `SELECT Id, Name, Lineitem_sku__c, Memorial_Bracelet__c,
              Memorial_Bracelet__r.Has_Graphic_Design__c,
              Memorial_Bracelet__r.Bracelet_Design_Created__c
       FROM Squarespace_Order_Item__c
       WHERE Production_Status__c = 'Needs Decision'
       LIMIT 100`
    );

    let advanced = 0;
    let needsDesign = 0;
    let skipped = 0;
    const errors = [];
    const results = [];

    for (const item of items) {
      const sku = item.Lineitem_sku__c || "";

      // Deep check: SF flags → SF ContentDocumentLink → Google Drive → Drive misname search
      // This also renames misnamed files and syncs SF flags when files are found
      const designCheck = await checkDesignExists(sku);

      if (designCheck === null) {
        // No hero found for this SKU — needs manual decision
        skipped++;
        results.push({ id: item.Id, name: item.Name, action: "skipped", reason: "No hero found for SKU" });
        continue;
      }

      if (designCheck.hasDesign) {
        // Design exists (found via: ${designCheck.source}) → advance to Ready to Laser
        try {
          const updateFields = {
            Production_Status__c: "Ready to Laser",
          };
          if (!item.Memorial_Bracelet__c) {
            updateFields.Memorial_Bracelet__c = designCheck.heroId;
          }
          await sfUpdate("Squarespace_Order_Item__c", item.Id, updateFields);
          advanced++;
          results.push({
            id: item.Id, name: item.Name, action: "advanced",
            newStatus: "Ready to Laser", source: designCheck.source,
          });
        } catch (e) {
          errors.push({ id: item.Id, name: item.Name, error: e.message });
        }
      } else {
        // No design found in SF flags, SF files, OR Google Drive → Design Needed
        try {
          const updateFields = {
            Production_Status__c: "Design Needed",
          };
          if (!item.Memorial_Bracelet__c) {
            updateFields.Memorial_Bracelet__c = designCheck.heroId;
          }
          await sfUpdate("Squarespace_Order_Item__c", item.Id, updateFields);
          needsDesign++;
          results.push({ id: item.Id, name: item.Name, action: "needsDesign", newStatus: "Design Needed" });
        } catch (e) {
          errors.push({ id: item.Id, name: item.Name, error: e.message });
        }
      }
    }

    return { advanced, needsDesign, skipped, errors, results };
  } catch (err) {
    console.error("Triage error:", err.message);
    return { advanced: 0, needsDesign: 0, skipped: 0, errors: [{ error: err.message }] };
  }
}

/**
 * Get all active order line items with parent order info
 */
export async function getActiveOrderItems() {
  if (!SF_LIVE) return [];
  try {
    const items = await sfQuery(
      `SELECT Id, Name, Lineitem_sku__c, Quantity__c, Unit_Price__c,
              Bracelet_Size__c, Production_Status__c, Fulfillment_Method__c,
              Manufactured__c, Product_Title__c, Memorial_Bracelet__c,
              Squarespace_Order__r.Name, Squarespace_Order__r.Order_Type__c,
              Squarespace_Order__r.Billing_Name__c, Squarespace_Order__r.Shipping_Name__c,
              Squarespace_Order__r.Shipping_City__c, Squarespace_Order__r.Shipping_State__c,
              Squarespace_Order__r.Billing_Email__c, Squarespace_Order__r.Order_Date__c,
              Squarespace_Order__r.Fulfillment_Status__c
       ,Memorial_Bracelet__r.Has_Graphic_Design__c,
              Memorial_Bracelet__r.Bracelet_Design_Created__c,
              Memorial_Bracelet__r.Design_Brief__c
       FROM Squarespace_Order_Item__c
       WHERE Production_Status__c != 'Shipped'
         AND Production_Status__c != null
       ORDER BY CreatedDate DESC
       LIMIT 200`
    );
    return items.map(mapLineItem);
  } catch (err) {
    console.error("Order items load error:", err.message);
    return [];
  }
}

/**
 * Get line items by production status
 */
export async function getItemsByStatus(status) {
  if (!SF_LIVE) return [];
  try {
    const items = await sfQuery(
      `SELECT Id, Name, Lineitem_sku__c, Quantity__c, Unit_Price__c,
              Bracelet_Size__c, Production_Status__c, Fulfillment_Method__c,
              Manufactured__c, Product_Title__c, Memorial_Bracelet__c,
              Squarespace_Order__r.Name, Squarespace_Order__r.Order_Type__c,
              Squarespace_Order__r.Billing_Name__c, Squarespace_Order__r.Shipping_Name__c,
              Squarespace_Order__r.Shipping_City__c, Squarespace_Order__r.Shipping_State__c,
              Squarespace_Order__r.Billing_Email__c, Squarespace_Order__r.Order_Date__c
       FROM Squarespace_Order_Item__c
       WHERE Production_Status__c = '${status}'
       ORDER BY CreatedDate DESC
       LIMIT 100`
    );
    return items.map(mapLineItem);
  } catch (err) {
    console.error(`Order items by status [${status}] error:`, err.message);
    return [];
  }
}

/**
 * Get order stats from SF
 */
export async function getOrderStats() {
  if (!SF_LIVE) {
    return { designNeeded: 0, designInProgress: 0, readyToLaser: 0, inProduction: 0, readyToShip: 0, shipped: 0, totalActive: 0, totalPaid: 0, totalDonated: 0 };
  }
  try {
    const [designNeeded, designInProgress, readyToLaser, inProduction, readyToShip, shipped] = await Promise.all([
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'Design Needed'"),
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'Design In Progress'"),
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'Ready to Laser'"),
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'In Production'"),
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'Ready to Ship'"),
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'Shipped'"),
    ]);

    const [totalPaid, totalDonated] = await Promise.all([
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order__c WHERE Order_Type__c = 'Paid-Squarespace'"),
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order__c WHERE Order_Type__c = 'Donated'"),
    ]);

    const dn = designNeeded[0]?.total || 0;
    const dip = designInProgress[0]?.total || 0;
    const rtl = readyToLaser[0]?.total || 0;
    const ip = inProduction[0]?.total || 0;
    const rts = readyToShip[0]?.total || 0;

    return {
      designNeeded: dn,
      designInProgress: dip,
      readyToLaser: rtl,
      inProduction: ip,
      readyToShip: rts,
      shipped: shipped[0]?.total || 0,
      totalActive: dn + dip + rtl + ip + rts,
      totalPaid: totalPaid[0]?.total || 0,
      totalDonated: totalDonated[0]?.total || 0,
    };
  } catch (err) {
    console.error("Order stats error:", err.message);
    return { designNeeded: 0, designInProgress: 0, readyToLaser: 0, inProduction: 0, readyToShip: 0, shipped: 0, totalActive: 0, totalPaid: 0, totalDonated: 0 };
  }
}

/**
 * Create a donated order in SF
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
}) {
  if (!SF_LIVE) return { success: false, mock: true };

  try {
    const orderName = `DON-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const order = await sfCreate("Squarespace_Order__c", {
      Name: orderName,
      Squarespace_Order_ID__c: `DON-${Date.now()}`,
      Order_Type__c: "Donated",
      Billing_Name__c: recipientName,
      Billing_Email__c: recipientEmail,
      Fulfillment_Status__c: "Unfulfilled",
      Order_Notes__c: `Source: ${source}. ${notes}`.trim(),
    });

    const totalQty = quantity || (quantity6 + quantity7) || 1;

    // Check if design already exists for this SKU
    const designCheck = sku ? await checkDesignExists(sku) : null;
    const hasDesign = designCheck?.hasDesign === true;
    const initialStatus = hasDesign ? "Ready to Laser" : "Design Needed";

    const itemFields = {
      Name: heroName,
      Squarespace_Order__c: order.id,
      Lineitem_sku__c: sku || "DONATED",
      Quantity__c: totalQty,
      Unit_Price__c: 0,
      Bracelet_Size__c: quantity6 > 0 ? "Small-6in" : "Regular-7in",
      Production_Status__c: initialStatus,
      Fulfillment_Method__c: fulfillmentMethod,
    };

    // Link to hero if found
    if (designCheck?.heroId) {
      itemFields.Memorial_Bracelet__c = designCheck.heroId;
    }

    const item = await sfCreate("Squarespace_Order_Item__c", itemFields);

    return {
      success: true,
      orderId: order.id,
      itemId: item.id,
      orderName,
      autoAdvanced: hasDesign,
      initialStatus,
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
  if (!SF_LIVE) return { success: false, mock: true };
  try {
    await sfUpdate("Squarespace_Order_Item__c", itemId, {
      Production_Status__c: newStatus,
    });
    return { success: true };
  } catch (err) {
    console.error("Update item status error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Auto-reconcile SF order items with ShipStation shipped orders.
 * Finds SF items not yet shipped that ShipStation shows as shipped,
 * and updates them to "Shipped" in SF. Also marks manufactured items as shipped.
 * Returns count of updated items.
 */
export async function reconcileWithShipStation() {
  if (!SF_LIVE) return { updated: 0, remaining: 0 };

  try {
    // Get SF items not yet shipped
    const sfItems = await sfQuery(
      `SELECT Id, Name, Squarespace_Order__r.Name, Manufactured__c
       FROM Squarespace_Order_Item__c
       WHERE Production_Status__c != 'Shipped'
         AND Production_Status__c != null
       LIMIT 200`
    );

    if (sfItems.length === 0) return { updated: 0, remaining: 0 };

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

    // Update matched items
    let updated = 0;
    for (const item of sfItems) {
      const sfOrderName = item.Squarespace_Order__r?.Name;
      const isShippedInSS = sfOrderName && ssOrderNumbers.has(sfOrderName);
      const isManufactured = item.Manufactured__c === true;

      if (isShippedInSS || isManufactured) {
        await sfUpdate("Squarespace_Order_Item__c", item.Id, {
          Production_Status__c: "Shipped",
        });
        updated++;
      }
    }

    return { updated, remaining: sfItems.length - updated };
  } catch (err) {
    console.error("Reconciliation error:", err.message);
    return { updated: 0, remaining: 0, error: err.message };
  }
}

/**
 * Get active orders grouped with their items
 */
export async function getGroupedOrders() {
  if (!SF_LIVE) return [];
  try {
    const items = await sfQuery(
      `SELECT Id, Name, Lineitem_sku__c, Quantity__c, Unit_Price__c,
              Bracelet_Size__c, Production_Status__c, Fulfillment_Method__c,
              Manufactured__c, Product_Title__c, Memorial_Bracelet__c,
              Squarespace_Order__c,
              Squarespace_Order__r.Id, Squarespace_Order__r.Name, Squarespace_Order__r.Order_Type__c,
              Squarespace_Order__r.Billing_Name__c, Squarespace_Order__r.Shipping_Name__c,
              Squarespace_Order__r.Shipping_City__c, Squarespace_Order__r.Shipping_State__c,
              Squarespace_Order__r.Billing_Email__c, Squarespace_Order__r.Order_Date__c,
              Squarespace_Order__r.Fulfillment_Status__c, Squarespace_Order__r.Order_Total__c,
              Memorial_Bracelet__r.Has_Graphic_Design__c,
              Memorial_Bracelet__r.Bracelet_Design_Created__c
       FROM Squarespace_Order_Item__c
       WHERE Production_Status__c != 'Shipped'
         AND Production_Status__c != null
       ORDER BY CreatedDate DESC
       LIMIT 200`
    );

    // Group by parent order
    const orderMap = new Map();
    for (const item of items) {
      const orderId = item.Squarespace_Order__c;
      const order = item.Squarespace_Order__r || {};
      if (!orderMap.has(orderId)) {
        orderMap.set(orderId, {
          id: orderId,
          name: order.Name || "",
          orderType: order.Order_Type__c || "",
          customerName: order.Billing_Name__c || order.Shipping_Name__c || "",
          shipTo: [order.Shipping_City__c, order.Shipping_State__c].filter(Boolean).join(", "),
          customerEmail: order.Billing_Email__c || "",
          orderDate: order.Order_Date__c || "",
          fulfillmentStatus: order.Fulfillment_Status__c || "",
          orderTotal: order.Order_Total__c || 0,
          items: [],
        });
      }
      const itemSku = item.Lineitem_sku__c || "";
      const hasDesign = item.Memorial_Bracelet__r?.Has_Graphic_Design__c || item.Memorial_Bracelet__r?.Bracelet_Design_Created__c || false;
      // Pass full SKU (with size) so download serves the correct size variant
      orderMap.get(orderId).items.push({
        id: item.Id,
        name: item.Name,
        sku: itemSku,
        quantity: item.Quantity__c || 1,
        unitPrice: item.Unit_Price__c || 0,
        size: item.Bracelet_Size__c || "",
        productionStatus: item.Production_Status__c || "Design Needed",
        fulfillmentMethod: item.Fulfillment_Method__c || "",
        manufactured: item.Manufactured__c || false,
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
  const order = r.Squarespace_Order__r || {};
  return {
    id: r.Id,
    name: r.Name,
    sku: r.Lineitem_sku__c || "",
    quantity: r.Quantity__c || 1,
    unitPrice: r.Unit_Price__c || 0,
    size: sizeFromSku(r.Lineitem_sku__c) || r.Bracelet_Size__c || "",
    productionStatus: r.Production_Status__c || "Design Needed",
    fulfillmentMethod: r.Fulfillment_Method__c || "",
    manufactured: r.Manufactured__c || false,
    productTitle: r.Product_Title__c || "",
    memorialBraceletId: r.Memorial_Bracelet__c || "",
    orderName: order.Name || "",
    orderType: order.Order_Type__c || "",
    customerName: order.Billing_Name__c || order.Shipping_Name__c || "",
    shipTo: [order.Shipping_City__c, order.Shipping_State__c].filter(Boolean).join(", ") || "",
    customerEmail: order.Billing_Email__c || "",
    orderDate: order.Order_Date__c || "",
    fulfillmentStatus: order.Fulfillment_Status__c || "",
    // Design info from linked memorial
    hasDesign: r.Memorial_Bracelet__r?.Has_Graphic_Design__c || r.Memorial_Bracelet__r?.Bracelet_Design_Created__c || false,
    designUrl: (r.Memorial_Bracelet__r?.Design_Brief__c || "").match(/https:\/\/[^\s]+/)?.[0] || "",
  };
}

// ---------------------------------------------------------------------------
// Monthly Report Queries — bracelet sales and donated bracelets by month
// ---------------------------------------------------------------------------

/**
 * Get all paid bracelet order items for a specific month.
 * Used by the monthly report (Sheet 2: Bracelet Sales).
 */
export async function getOrdersByMonth(month, year) {
  if (!SF_LIVE) return [];

  try {
    // Squarespace stores Order_Date__c in UTC, but orders are placed in Eastern time.
    // A Jan 31 9:45 PM ET order = Feb 1 2:45 AM UTC. To match Squarespace's own monthly
    // boundaries, offset by 5 hours (ET = UTC-5). This ensures the SOQL date range
    // aligns with what Squarespace shows as the order month.
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const items = await sfQuery(`
      SELECT Id, Lineitem_sku__c, Quantity__c, Unit_Price__c,
             Product_Title__c, Bracelet_Size__c,
             Memorial_Bracelet__c,
             Memorial_Bracelet__r.Name,
             Memorial_Bracelet__r.Associated_Organization__c,
             Memorial_Bracelet__r.Associated_Organization__r.Name,
             Squarespace_Order__r.Name,
             Squarespace_Order__r.Order_Date__c,
             Squarespace_Order__r.Order_Type__c,
             Squarespace_Order__r.Billing_Name__c,
             Squarespace_Order__r.Billing_Email__c
      FROM Squarespace_Order_Item__c
      WHERE Squarespace_Order__r.Order_Type__c = 'Paid-Squarespace'
        AND Squarespace_Order__r.Order_Date__c >= ${startDate}T05:00:00.000Z
        AND Squarespace_Order__r.Order_Date__c < ${endDate}T05:00:00.000Z
      ORDER BY Squarespace_Order__r.Order_Date__c ASC
    `.trim());

    return items.map((r) => {
      const sku = r.Lineitem_sku__c || "";
      const unitPrice = r.Unit_Price__c || 0;
      const qty = r.Quantity__c || 1;
      const isDVar = sku.toUpperCase().endsWith("-7D") || sku.toUpperCase().endsWith("-6D") || unitPrice === 45;
      // isBracelet: true for ALL bracelet products regardless of price (includes bulk/wholesale)
      // generatesObligation: only $35 or $45 bracelets create a $10 charity obligation
      const isBracelet = sku.length > 0;
      const generatesObligation = unitPrice === 35 || unitPrice === 45;
      const org = r.Memorial_Bracelet__r?.Associated_Organization__r;

      return {
        id: r.Id,
        orderDate: r.Squarespace_Order__r?.Order_Date__c || "",
        orderNumber: r.Squarespace_Order__r?.Name || "",
        customerName: r.Squarespace_Order__r?.Billing_Name__c || "",
        sku,
        heroName: r.Memorial_Bracelet__r?.Name || "",
        size: sizeFromSku(sku) || r.Bracelet_Size__c || "",
        quantity: qty,
        unitPrice,
        lineTotal: Math.round(unitPrice * qty * 100) / 100,
        isDVariant: isDVar,
        isBracelet,
        generatesObligation,
        designatedOrg: org?.Name || "",
        designatedOrgId: r.Memorial_Bracelet__r?.Associated_Organization__c || "",
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
 * Used by the monthly report (Sheet 5: Donated Bracelets).
 */
export async function getDonatedOrdersByMonth(month, year) {
  if (!SF_LIVE) return [];

  try {
    // Same ET timezone offset as getOrdersByMonth — see comment there.
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const items = await sfQuery(`
      SELECT Id, Lineitem_sku__c, Quantity__c, Unit_Price__c, Unit_Cost__c, Total_Cost__c,
             Bracelet_Size__c, Product_Title__c,
             Memorial_Bracelet__r.Name,
             Squarespace_Order__r.Name,
             Squarespace_Order__r.Order_Date__c,
             Squarespace_Order__r.Shipping_Name__c,
             Squarespace_Order__r.Shipping_City__c,
             Squarespace_Order__r.Shipping_State__c
      FROM Squarespace_Order_Item__c
      WHERE Squarespace_Order__r.Order_Type__c = 'Donated'
        AND Squarespace_Order__r.Order_Date__c >= ${startDate}T05:00:00.000Z
        AND Squarespace_Order__r.Order_Date__c < ${endDate}T05:00:00.000Z
      ORDER BY Squarespace_Order__r.Order_Date__c ASC
    `.trim());

    return items.map((r) => ({
      id: r.Id,
      orderDate: r.Squarespace_Order__r?.Order_Date__c || "",
      orderNumber: r.Squarespace_Order__r?.Name || "",
      heroName: r.Memorial_Bracelet__r?.Name || "",
      sku: r.Lineitem_sku__c || "",
      size: sizeFromSku(r.Lineitem_sku__c) || r.Bracelet_Size__c || "",
      quantity: r.Quantity__c || 1,
      unitCost: r.Unit_Cost__c || 2.0, // Default in-house cost
      totalCost: r.Total_Cost__c || (r.Quantity__c || 1) * (r.Unit_Cost__c || 2.0),
      recipient: r.Squarespace_Order__r?.Shipping_Name__c || "",
      recipientLocation: [
        r.Squarespace_Order__r?.Shipping_City__c,
        r.Squarespace_Order__r?.Shipping_State__c,
      ].filter(Boolean).join(", "),
    }));
  } catch (err) {
    console.error("getDonatedOrdersByMonth error:", err.message);
    return [];
  }
}

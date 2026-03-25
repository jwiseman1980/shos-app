import { sfQuery, sfCreate, sfUpdate } from "@/lib/salesforce";
import { listOrders } from "@/lib/shipstation";

const SF_LIVE = process.env.SF_LIVE === "true";

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
    return { needsDecision: 0, designNeeded: 0, designInProgress: 0, readyToLaser: 0, inProduction: 0, readyToShip: 0, shipped: 0, totalActive: 0, totalPaid: 0, totalDonated: 0 };
  }
  try {
    const [needsDecision, designNeeded, designInProgress, readyToLaser, inProduction, readyToShip, shipped] = await Promise.all([
      sfQuery("SELECT COUNT(Id) total FROM Squarespace_Order_Item__c WHERE Production_Status__c = 'Needs Decision'"),
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

    const nd = needsDecision[0]?.total || 0;
    const dn = designNeeded[0]?.total || 0;
    const dip = designInProgress[0]?.total || 0;
    const rtl = readyToLaser[0]?.total || 0;
    const ip = inProduction[0]?.total || 0;
    const rts = readyToShip[0]?.total || 0;

    return {
      needsDecision: nd,
      designNeeded: dn,
      designInProgress: dip,
      readyToLaser: rtl,
      inProduction: ip,
      readyToShip: rts,
      shipped: shipped[0]?.total || 0,
      totalActive: nd + dn + dip + rtl + ip + rts,
      totalPaid: totalPaid[0]?.total || 0,
      totalDonated: totalDonated[0]?.total || 0,
    };
  } catch (err) {
    console.error("Order stats error:", err.message);
    return { needsDecision: 0, designNeeded: 0, designInProgress: 0, readyToLaser: 0, inProduction: 0, readyToShip: 0, shipped: 0, totalActive: 0, totalPaid: 0, totalDonated: 0 };
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
    const item = await sfCreate("Squarespace_Order_Item__c", {
      Name: heroName,
      Squarespace_Order__c: order.id,
      Lineitem_sku__c: sku || "DONATED",
      Quantity__c: totalQty,
      Unit_Price__c: 0,
      Bracelet_Size__c: quantity6 > 0 ? "Small-6in" : "Regular-7in",
      Production_Status__c: "Needs Decision",
      Fulfillment_Method__c: fulfillmentMethod,
    });

    return { success: true, orderId: order.id, itemId: item.id, orderName };
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
 * Finds SF items stuck at "Needs Decision" that ShipStation shows as shipped,
 * and updates them to "Shipped" in SF. Also marks manufactured items as shipped.
 * Returns count of updated items.
 */
export async function reconcileWithShipStation() {
  if (!SF_LIVE) return { updated: 0, remaining: 0 };

  try {
    // Get SF items stuck at Needs Decision
    const sfItems = await sfQuery(
      `SELECT Id, Name, Squarespace_Order__r.Name, Manufactured__c
       FROM Squarespace_Order_Item__c
       WHERE Production_Status__c = 'Needs Decision'
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
      const baseSku = itemSku.replace(/-[67]$/, "").replace(/-[67]D$/, "").replace(/_-D$/, "").replace(/-D$/, "");
      const hasDesign = item.Memorial_Bracelet__r?.Has_Graphic_Design__c || item.Memorial_Bracelet__r?.Bracelet_Design_Created__c || false;
      orderMap.get(orderId).items.push({
        id: item.Id,
        name: item.Name,
        sku: itemSku,
        quantity: item.Quantity__c || 1,
        unitPrice: item.Unit_Price__c || 0,
        size: item.Bracelet_Size__c || "",
        productionStatus: item.Production_Status__c || "Needs Decision",
        fulfillmentMethod: item.Fulfillment_Method__c || "",
        manufactured: item.Manufactured__c || false,
        hasDesign,
        designUrl: hasDesign && baseSku ? `/api/designs/download?sku=${encodeURIComponent(baseSku)}` : "",
      });
    }

    return Array.from(orderMap.values());
  } catch (err) {
    console.error("Grouped orders error:", err.message);
    return [];
  }
}

function mapLineItem(r) {
  const order = r.Squarespace_Order__r || {};
  return {
    id: r.Id,
    name: r.Name,
    sku: r.Lineitem_sku__c || "",
    quantity: r.Quantity__c || 1,
    unitPrice: r.Unit_Price__c || 0,
    size: r.Bracelet_Size__c || "",
    productionStatus: r.Production_Status__c || "Needs Decision",
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

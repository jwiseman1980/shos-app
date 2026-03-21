import {
  queryDatabase,
  createPage,
  updatePage,
  getText,
  getSelect,
  getNumber,
  getDate,
  getRelation,
} from "@/lib/notion";

// Notion Order Queue database ID
const ORDER_QUEUE_DB = "512a6ccd-715e-4502-8e5e-4333def8bc12";

/**
 * Map a raw Notion page to a flat order object for the dashboard.
 */
function mapOrder(page) {
  const p = page.properties;
  return {
    id: page.id,
    orderName: getText(p["Order Name"] || p["Name"]),
    heroName: getText(p["Hero Name"]),
    recipientName: getText(p["Recipient Name"]),
    recipientEmail: getText(p["Recipient Email"]),
    orderType: getSelect(p["Order Type"]),
    status: getSelect(p["Production Status"] || p["Status"]),
    fulfillmentMethod: getSelect(p["Fulfillment Method"]),
    source: getSelect(p["Source"]),
    sourceReference: getText(p["Source Reference"]),
    quantity: getNumber(p["Quantity"] || p["Quantity Total"]),
    quantity6: getNumber(p["Quantity 6-inch"]),
    quantity7: getNumber(p["Quantity 7-inch"]),
    orderDate: getDate(p["Order Date"]),
    shipDate: getDate(p["Ship Date"]),
    trackingNumber: getText(p["Tracking Number"]),
    sfOrderId: getText(p["SF Order ID"]),
    shipStationId: getText(p["ShipStation Order ID"]),
    notes: getText(p["Notes"]),
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

/**
 * Get all orders from the Notion Order Queue.
 */
export async function getOrders() {
  try {
    const pages = await queryDatabase(ORDER_QUEUE_DB, {
      sorts: [{ property: "Order Date", direction: "descending" }],
    });
    return pages.map(mapOrder);
  } catch (err) {
    console.error("Failed to fetch orders from Notion:", err.message);
    return [];
  }
}

/**
 * Get orders filtered by status.
 */
export async function getOrdersByStatus(status) {
  try {
    const pages = await queryDatabase(ORDER_QUEUE_DB, {
      filter: {
        property: "Production Status",
        select: { equals: status },
      },
      sorts: [{ property: "Order Date", direction: "descending" }],
    });
    return pages.map(mapOrder);
  } catch (err) {
    console.error(`Failed to fetch orders with status "${status}":`, err.message);
    return [];
  }
}

/**
 * Get orders that need design work (no existing bracelet design).
 */
export async function getOrdersNeedingDesign() {
  try {
    const pages = await queryDatabase(ORDER_QUEUE_DB, {
      filter: {
        property: "Production Status",
        select: { equals: "Design Needed" },
      },
    });
    return pages.map(mapOrder);
  } catch (err) {
    console.error("Failed to fetch design-needed orders:", err.message);
    return [];
  }
}

/**
 * Compute aggregate stats from orders.
 */
export async function getOrderStats() {
  const orders = await getOrders();
  const total = orders.length;

  const statusCounts = {};
  const typeCounts = {};
  let totalUnits = 0;

  for (const o of orders) {
    const s = o.status || "Unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;

    const t = o.orderType || "Unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;

    totalUnits += o.quantity || 0;
  }

  // Active = not shipped or synced
  const terminalStatuses = ["Shipped", "Synced to Salesforce", "Complete", "Cancelled"];
  const activeCount = orders.filter((o) => !terminalStatuses.includes(o.status)).length;

  return {
    total,
    active: activeCount,
    totalUnits,
    statusCounts,
    typeCounts,
  };
}

/**
 * Update an order's status in Notion.
 */
export async function updateOrderStatus(pageId, newStatus) {
  return updatePage(pageId, {
    "Production Status": { select: { name: newStatus } },
  });
}

/**
 * Create a new donated bracelet order in the Order Queue.
 */
export async function createDonatedOrder({
  heroName,
  recipientName,
  recipientEmail,
  quantity,
  quantity6,
  quantity7,
  source = "App",
  notes = "",
  fulfillmentMethod = "Design + Laser",
}) {
  const today = new Date().toISOString().split("T")[0];
  const orderName = `${heroName.split(" ").pop()} — ${recipientName.split(" ").pop()} (Donated)`;

  const properties = {
    "Order Name": { title: [{ text: { content: orderName } }] },
    "Hero Name": { rich_text: [{ text: { content: heroName } }] },
    "Recipient Name": { rich_text: [{ text: { content: recipientName } }] },
    "Order Type": { select: { name: "Donated" } },
    "Production Status": { select: { name: "Intake" } },
    "Fulfillment Method": { select: { name: fulfillmentMethod } },
    "Source": { select: { name: source } },
    "Order Date": { date: { start: today } },
  };

  if (recipientEmail) {
    properties["Recipient Email"] = { rich_text: [{ text: { content: recipientEmail } }] };
  }
  if (quantity) {
    properties["Quantity"] = { number: quantity };
  }
  if (quantity6) {
    properties["Quantity 6-inch"] = { number: quantity6 };
  }
  if (quantity7) {
    properties["Quantity 7-inch"] = { number: quantity7 };
  }
  if (notes) {
    properties["Notes"] = { rich_text: [{ text: { content: notes } }] };
  }

  return createPage(ORDER_QUEUE_DB, properties);
}

/**
 * ShipStation API Client
 * V1 API — Basic Auth (API Key : API Secret)
 * Docs: https://shipstation.com/docs/api
 */

const API_BASE = "https://ssapi.shipstation.com";

function getAuth() {
  const key = process.env.SHIPSTATION_API_KEY;
  const secret = process.env.SHIPSTATION_API_SECRET;
  if (!key || !secret) {
    throw new Error("SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET required");
  }
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

async function ssRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuth(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ShipStation ${res.status}: ${text}`);
  }

  // Some endpoints return empty body (204)
  if (res.status === 204) return null;
  return res.json();
}

// ─── Orders ──────────────────────────────────────────────

/**
 * List orders with optional filters
 * @param {Object} params - Query parameters
 * @param {string} params.orderStatus - awaiting_payment, awaiting_shipment, shipped, cancelled, on_hold
 * @param {string} params.sortBy - OrderDate, ModifyDate, CreateDate
 * @param {string} params.sortDir - ASC, DESC
 * @param {number} params.page - Page number (1-based)
 * @param {number} params.pageSize - Results per page (max 500)
 * @param {string} params.orderDateStart - ISO date string
 * @param {string} params.orderDateEnd - ISO date string
 */
export async function listOrders(params = {}) {
  const query = new URLSearchParams();
  if (params.orderStatus) query.set("orderStatus", params.orderStatus);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  if (params.page) query.set("page", params.page);
  if (params.pageSize) query.set("pageSize", params.pageSize);
  if (params.orderDateStart) query.set("orderDateStart", params.orderDateStart);
  if (params.orderDateEnd) query.set("orderDateEnd", params.orderDateEnd);
  if (params.storeId) query.set("storeId", params.storeId);

  const qs = query.toString();
  return ssRequest(`/orders${qs ? "?" + qs : ""}`);
}

/**
 * Get awaiting shipment orders
 */
export async function getAwaitingShipment() {
  return listOrders({
    orderStatus: "awaiting_shipment",
    sortBy: "OrderDate",
    sortDir: "DESC",
    pageSize: 100,
  });
}

/**
 * Get recently shipped orders
 */
export async function getRecentlyShipped(pageSize = 50) {
  return listOrders({
    orderStatus: "shipped",
    sortBy: "ModifyDate",
    sortDir: "DESC",
    pageSize,
  });
}

/**
 * Get a single order by ID
 */
export async function getOrder(orderId) {
  return ssRequest(`/orders/${orderId}`);
}

/**
 * Create or update an order in ShipStation
 * Used for pushing donated bracelet orders from the app
 */
export async function createOrder(orderData) {
  return ssRequest("/orders/createorder", {
    method: "POST",
    body: JSON.stringify(orderData),
  });
}

// ─── Shipments ───────────────────────────────────────────

/**
 * List shipments with optional filters
 */
export async function listShipments(params = {}) {
  const query = new URLSearchParams();
  if (params.shipDateStart) query.set("shipDateStart", params.shipDateStart);
  if (params.shipDateEnd) query.set("shipDateEnd", params.shipDateEnd);
  if (params.page) query.set("page", params.page);
  if (params.pageSize) query.set("pageSize", params.pageSize);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);

  const qs = query.toString();
  return ssRequest(`/shipments${qs ? "?" + qs : ""}`);
}

// ─── Stores ──────────────────────────────────────────────

/**
 * List connected stores (selling channels)
 */
export async function listStores() {
  return ssRequest("/stores");
}

// ─── Products ────────────────────────────────────────────

/**
 * List products (SKUs)
 */
export async function listProducts(params = {}) {
  const query = new URLSearchParams();
  if (params.sku) query.set("sku", params.sku);
  if (params.name) query.set("name", params.name);
  if (params.page) query.set("page", params.page);
  if (params.pageSize) query.set("pageSize", params.pageSize);

  const qs = query.toString();
  return ssRequest(`/products${qs ? "?" + qs : ""}`);
}

// ─── Warehouses ──────────────────────────────────────────

/**
 * List warehouses (ship-from locations)
 */
export async function listWarehouses() {
  return ssRequest("/warehouses");
}

// ─── Carriers ────────────────────────────────────────────

/**
 * List carriers
 */
export async function listCarriers() {
  return ssRequest("/carriers");
}

// ─── Fulfillments ────────────────────────────────────────

/**
 * List fulfillments (completed shipments)
 */
export async function listFulfillments(params = {}) {
  const query = new URLSearchParams();
  if (params.orderId) query.set("orderId", params.orderId);
  if (params.page) query.set("page", params.page);
  if (params.pageSize) query.set("pageSize", params.pageSize);

  const qs = query.toString();
  return ssRequest(`/fulfillments${qs ? "?" + qs : ""}`);
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Build a ShipStation order object for a donated bracelet order
 */
export function buildDonatedOrder({
  heroName,
  sku,
  recipientName,
  recipientEmail,
  quantity,
  size,
  address,
  city,
  state,
  zip,
  country = "US",
  notes = "",
}) {
  return {
    orderNumber: `DON-${Date.now()}`,
    orderDate: new Date().toISOString(),
    orderStatus: "awaiting_shipment",
    billTo: {
      name: "Steel Hearts",
      company: "Steel Hearts 501(c)(3)",
    },
    shipTo: {
      name: recipientName,
      street1: address || "",
      city: city || "",
      state: state || "",
      postalCode: zip || "",
      country: country,
    },
    items: [
      {
        sku: sku ? `${sku}-${size === "6" ? "6" : "7"}` : "",
        name: heroName || "Memorial Bracelet",
        quantity: quantity || 1,
        unitPrice: 0,
      },
    ],
    internalNotes: notes,
    customerEmail: recipientEmail || "",
    amountPaid: 0,
    shippingAmount: 0,
    taxAmount: 0,
  };
}

/**
 * Get order stats summary
 */
export async function getOrderStats() {
  try {
    const [awaiting, shipped] = await Promise.all([
      getAwaitingShipment(),
      getRecentlyShipped(10),
    ]);

    return {
      awaitingCount: awaiting?.total || 0,
      awaitingOrders: (awaiting?.orders || []).map((o) => ({
        orderId: o.orderId,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate,
        orderTotal: o.orderTotal,
        items: (o.items || []).map((i) => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
        })),
        shipTo: o.shipTo?.name || "",
        age: Math.floor(
          (Date.now() - new Date(o.orderDate).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      recentShipped: (shipped?.orders || []).slice(0, 5).map((o) => ({
        orderId: o.orderId,
        orderNumber: o.orderNumber,
        shipDate: o.shipDate,
        orderTotal: o.orderTotal,
        shipTo: o.shipTo?.name || "",
        trackingNumber: o.shipments?.[0]?.trackingNumber || "",
      })),
    };
  } catch (err) {
    console.error("ShipStation stats error:", err.message);
    return {
      awaitingCount: 0,
      awaitingOrders: [],
      recentShipped: [],
      error: err.message,
    };
  }
}

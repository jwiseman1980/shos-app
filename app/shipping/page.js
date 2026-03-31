export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import ShippingQueue from "@/components/ShippingQueue";
import { getAwaitingShipment, getRecentlyShipped } from "@/lib/shipstation";
import { getServerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export default async function ShippingPage() {
  const user = await getSessionUser();
  let awaiting = [];
  let recent = [];
  let error = null;

  try {
    const sb = getServerClient();

    // --- Source 1: ShipStation orders awaiting shipment ---
    let ssOrders = [];
    try {
      const awaitingRes = await getAwaitingShipment();
      ssOrders = awaitingRes?.orders || awaitingRes || [];
      if (!Array.isArray(ssOrders)) ssOrders = [];
    } catch (ssErr) {
      console.warn("ShipStation fetch failed:", ssErr.message);
    }
    const ssOrderNumbers = new Set(ssOrders.map((o) => o.orderNumber).filter(Boolean));

    // --- Source 2: Supabase items at ready_to_ship (includes burnout stock fulfillment) ---
    const { data: sbReadyItems } = await sb
      .from("order_items")
      .select(`
        id, lineitem_sku, quantity, bracelet_size, production_status,
        order:orders!order_id(order_number, order_date, billing_name, shipping_name,
          shipping_address1, shipping_city, shipping_state, shipping_postal, shipping_country,
          billing_email, order_type),
        hero:heroes!hero_id(name)
      `)
      .eq("production_status", "ready_to_ship")
      .order("created_at", { ascending: false })
      .limit(100);

    // Build a unified awaiting list
    // ShipStation orders that have ALL items ready in Supabase
    const { data: allSbItems } = await sb
      .from("order_items")
      .select("production_status, order:orders!order_id(order_number)")
      .not("production_status", "in", '("ready_to_ship","shipped")')
      .limit(500);
    const notReadyOrderNumbers = new Set(
      (allSbItems || []).map((r) => r.order?.order_number).filter(Boolean)
    );

    // ShipStation orders filtered by Supabase readiness
    for (const o of ssOrders) {
      if (!notReadyOrderNumbers.has(o.orderNumber)) {
        awaiting.push({
          orderId: o.orderId,
          orderNumber: o.orderNumber,
          orderDate: o.orderDate,
          orderTotal: o.orderTotal,
          shipTo: o.shipTo,
          items: (o.items || []).map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity })),
          customerEmail: o.customerEmail || "",
          internalNotes: o.internalNotes || "",
          orderStatus: o.orderStatus,
          source: "shipstation",
        });
      }
    }

    // Supabase ready_to_ship orders NOT in ShipStation (e.g., burnout stock fulfillment)
    const sbOrderMap = new Map();
    for (const item of (sbReadyItems || [])) {
      const orderNum = item.order?.order_number;
      if (!orderNum || ssOrderNumbers.has(orderNum)) continue;
      if (!sbOrderMap.has(orderNum)) {
        const o = item.order;
        sbOrderMap.set(orderNum, {
          orderId: item.id,
          orderNumber: orderNum,
          orderDate: o.order_date,
          orderTotal: 0,
          shipTo: {
            name: o.shipping_name || o.billing_name || "",
            street1: o.shipping_address1 || "",
            city: o.shipping_city || "",
            state: o.shipping_state || "",
            postalCode: o.shipping_postal || "",
            country: o.shipping_country || "US",
          },
          items: [],
          customerEmail: o.billing_email || "",
          internalNotes: "From burnout stock — not in ShipStation",
          orderStatus: "awaiting_shipment",
          source: "supabase",
          orderType: o.order_type,
        });
      }
      sbOrderMap.get(orderNum).items.push({
        sku: item.lineitem_sku,
        name: item.hero?.name || item.lineitem_sku,
        quantity: item.quantity || 1,
      });
    }
    // Only add Supabase orders where ALL items are ready
    for (const [orderNum, order] of sbOrderMap) {
      if (!notReadyOrderNumbers.has(orderNum)) {
        awaiting.push(order);
      }
    }

    // Sort by order date ascending (oldest first)
    awaiting.sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate));

    // Recently shipped from ShipStation
    const recentRes = await getRecentlyShipped(10);
    const recentOrders = recentRes?.orders || recentRes || [];
    recent = (Array.isArray(recentOrders) ? recentOrders : []).map((o) => ({
      orderNumber: o.orderNumber,
      shipDate: o.shipDate,
      shipTo: o.shipTo,
      trackingNumber: o.shipments?.[0]?.trackingNumber || "",
      carrier: o.shipments?.[0]?.carrierCode || "",
      orderTotal: o.orderTotal,
      items: (o.items || []).map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity })),
    }));
  } catch (err) {
    error = err.message;
  }

  return (
    <PageShell
      title="Shipping Queue"
      subtitle="Print labels, pack, and ship — live from ShipStation + Supabase"
    >
      <div className="stat-grid">
        <StatBlock
          label="Awaiting Shipment"
          value={awaiting.length}
          note="Ready to print and ship"
          accent={awaiting.length > 0 ? "var(--status-orange)" : "var(--status-green)"}
        />
        <StatBlock
          label="Shipped This Week"
          value={recent.filter((o) => {
            const d = new Date(o.shipDate);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return d > weekAgo;
          }).length}
          note="Last 7 days"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Oldest Waiting"
          value={awaiting.length > 0
            ? Math.floor((Date.now() - new Date(awaiting[0]?.orderDate).getTime()) / 86400000) + "d"
            : "\u2014"}
          note={awaiting.length > 0 ? "Needs attention" : "All clear"}
          accent={awaiting.length > 0 ? "var(--status-red)" : "var(--status-green)"}
        />
        <StatBlock
          label="Source"
          value="Live"
          note="ShipStation + Supabase"
          accent="var(--gold)"
        />
      </div>

      {error && (
        <div className="section">
          <DataCard title="Connection Error">
            <div style={{ color: "var(--status-red)", fontSize: 13 }}>
              {error}
            </div>
          </DataCard>
        </div>
      )}

      <div className="section">
        <DataCard title={`Awaiting Shipment (${awaiting.length})`}>
          {awaiting.length > 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
              These orders are ready to go. Print label in ShipStation, pack, and ship.
            </div>
          ) : null}
          <ShippingQueue orders={awaiting} />
        </DataCard>
      </div>

      {recent.length > 0 && (
        <div className="section">
          <DataCard title={`Recently Shipped (${recent.length})`}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={thStyle}>Order</th>
                    <th style={thStyle}>Items</th>
                    <th style={thStyle}>Ship To</th>
                    <th style={thStyle}>Shipped</th>
                    <th style={thStyle}>Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.orderNumber} style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--text-bright)" }}>
                        {o.orderNumber}
                      </td>
                      <td style={tdStyle}>
                        {o.items.map((i, idx) => (
                          <div key={idx} style={{ fontSize: 11, color: "var(--text-dim)" }}>
                            {i.sku || i.name} x{i.quantity}
                          </div>
                        ))}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 12, color: "var(--text-bright)" }}>{o.shipTo?.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {[o.shipTo?.city, o.shipTo?.state].filter(Boolean).join(", ")}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                        {o.shipDate ? new Date(o.shipDate).toLocaleDateString() : "\u2014"}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                        {o.trackingNumber || "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        </div>
      )}
    </PageShell>
  );
}

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "top" };
const thStyle = {
  padding: "8px 12px", fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", textAlign: "left",
};

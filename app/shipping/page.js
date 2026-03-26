export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import ShippingQueue from "@/components/ShippingQueue";
import { getAwaitingShipment, getRecentlyShipped } from "@/lib/shipstation";
import { getSessionUser } from "@/lib/auth";

export default async function ShippingPage() {
  const user = await getSessionUser();
  let awaiting = [];
  let recent = [];
  let error = null;

  try {
    const awaitingRes = await getAwaitingShipment();
    const awaitingOrders = awaitingRes?.orders || awaitingRes || [];
    awaiting = (Array.isArray(awaitingOrders) ? awaitingOrders : []).map((o) => ({
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      orderTotal: o.orderTotal,
      shipTo: o.shipTo,
      items: (o.items || []).map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
      })),
      customerEmail: o.customerEmail || "",
      internalNotes: o.internalNotes || "",
      orderStatus: o.orderStatus,
    }));

    const recentRes = await getRecentlyShipped(10);
    const recentOrders = recentRes?.orders || recentRes || [];
    recent = (Array.isArray(recentOrders) ? recentOrders : []).map((o) => ({
      orderNumber: o.orderNumber,
      shipDate: o.shipDate,
      shipTo: o.shipTo,
      trackingNumber: o.shipments?.[0]?.trackingNumber || "",
      carrier: o.shipments?.[0]?.carrierCode || "",
      orderTotal: o.orderTotal,
      items: (o.items || []).map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
      })),
    }));
  } catch (err) {
    error = err.message;
  }

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <PageShell
      title="Shipping Queue"
      subtitle="Print labels, pack, and ship — live from ShipStation"
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
            ? Math.floor((Date.now() - new Date(awaiting[awaiting.length - 1]?.orderDate).getTime()) / 86400000) + "d"
            : "\u2014"}
          note={awaiting.length > 0 ? "Needs attention" : "All clear"}
          accent={awaiting.length > 0 ? "var(--status-red)" : "var(--status-green)"}
        />
        <StatBlock
          label="Source"
          value="Live"
          note="ShipStation API"
          accent="var(--gold)"
        />
      </div>

      {error && (
        <div className="section">
          <DataCard title="Connection Error">
            <div style={{ color: "var(--status-red)", fontSize: 13 }}>
              ShipStation: {error}
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

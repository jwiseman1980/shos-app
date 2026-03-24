export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import { getActiveOrderItems, getOrderStats, reconcileWithShipStation } from "@/lib/data/orders";
import { getAwaitingShipment, getRecentlyShipped } from "@/lib/shipstation";

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "top" };
const thStyle = {
  padding: "8px 12px", fontSize: 11, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", textAlign: "left",
};

const statusColors = {
  "Needs Decision": { bg: "#ef444422", text: "#ef4444" },
  "Design Needed": { bg: "#f59e0b22", text: "#f59e0b" },
  "Design In Progress": { bg: "#8b5cf622", text: "#8b5cf6" },
  "Ready to Laser": { bg: "#3b82f622", text: "#3b82f6" },
  "In Production": { bg: "#06b6d422", text: "#06b6d4" },
  "Ready to Ship": { bg: "#22c55e22", text: "#22c55e" },
  "Shipped": { bg: "#6b728022", text: "#6b7280" },
};

function StatusBadge({ status }) {
  const c = statusColors[status] || { bg: "#6b728022", text: "#6b7280" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {status}
    </span>
  );
}

function OrderItemTable({ items }) {
  if (items.length === 0) {
    return <div style={{ padding: "16px 0", color: "var(--text-dim)", fontSize: 13 }}>No items.</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
            <th style={thStyle}>Item</th>
            <th style={thStyle}>SKU</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Size</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Method</th>
            <th style={thStyle}>Customer</th>
            <th style={thStyle}>Order</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>{item.name}</div>
                {item.productTitle && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.productTitle}</div>
                )}
              </td>
              <td style={tdStyle}>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                  {item.sku || "\u2014"}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: "center", color: "var(--text-bright)" }}>
                {item.quantity}
              </td>
              <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                {item.size === "Regular-7in" ? '7"' : item.size === "Small-6in" ? '6"' : item.size || "\u2014"}
              </td>
              <td style={tdStyle}><StatusBadge status={item.productionStatus} /></td>
              <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-dim)" }}>
                {item.fulfillmentMethod || "\u2014"}
              </td>
              <td style={tdStyle}>
                <div style={{ fontSize: 12, color: "var(--text-bright)" }}>{item.customerName}</div>
                {item.shipTo && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.shipTo}</div>
                )}
              </td>
              <td style={tdStyle}>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.orderName}</div>
                <div style={{ fontSize: 10, color: item.orderType === "Donated" ? "var(--gold)" : "var(--text-dim)" }}>
                  {item.orderType}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShipStationTable({ orders }) {
  if (!orders || orders.length === 0) {
    return <div style={{ padding: "16px 0", color: "var(--text-dim)", fontSize: 13 }}>No orders.</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
            <th style={thStyle}>Order #</th>
            <th style={thStyle}>Items</th>
            <th style={thStyle}>Ship To</th>
            <th style={thStyle}>Age</th>
            <th style={thStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.orderNumber} style={{ borderBottom: "1px solid var(--card-border)" }}>
              <td style={{ ...tdStyle, fontWeight: 500, color: "var(--text-bright)" }}>{o.orderNumber}</td>
              <td style={tdStyle}>
                {o.items && o.items.map((item, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {item.sku || item.name} x{item.quantity}
                  </div>
                ))}
              </td>
              <td style={tdStyle}>
                <div style={{ fontSize: 12, color: "var(--text-bright)" }}>{o.shipTo?.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {[o.shipTo?.city, o.shipTo?.state].filter(Boolean).join(", ")}
                </div>
              </td>
              <td style={tdStyle}>
                {(() => {
                  const days = o.orderDate ? Math.floor((Date.now() - new Date(o.orderDate)) / 86400000) : 0;
                  const color = days >= 7 ? "#ef4444" : days >= 3 ? "#f59e0b" : "#22c55e";
                  return <span style={{ fontWeight: 600, color }}>{days}d</span>;
                })()}
              </td>
              <td style={{ ...tdStyle, color: "var(--text-bright)" }}>
                {o.orderTotal ? `$${o.orderTotal.toFixed(2)}` : "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OrdersPage() {
  let sfItems = [], sfStats = {}, ssAwaiting = [], ssRecent = [], ssError = null, reconciled = null;

  // Auto-reconcile shipped orders on page load
  try {
    reconciled = await reconcileWithShipStation();
  } catch (err) {
    console.warn("Reconciliation skipped:", err.message);
  }

  try {
    [sfItems, sfStats] = await Promise.all([
      getActiveOrderItems(),
      getOrderStats(),
    ]);
  } catch (err) {
    console.error("SF order load error:", err.message);
  }

  try {
    const awaitingRes = await getAwaitingShipment();
    const awaitingOrders = awaitingRes?.orders || awaitingRes || [];
    ssAwaiting = (Array.isArray(awaitingOrders) ? awaitingOrders : []).map((o) => ({
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      orderTotal: o.orderTotal,
      shipTo: o.shipTo,
      items: o.items,
    }));
    const recentRes = await getRecentlyShipped(5);
    const recentOrders = recentRes?.orders || recentRes || [];
    ssRecent = (Array.isArray(recentOrders) ? recentOrders : []).map((o) => ({
      orderNumber: o.orderNumber,
      shipDate: o.shipDate,
      shipTo: o.shipTo,
      trackingNumber: o.shipments?.[0]?.trackingNumber || "",
      orderTotal: o.orderTotal,
    }));
  } catch (err) {
    ssError = err.message;
  }

  const needsDecision = sfItems.filter((i) => i.productionStatus === "Needs Decision");
  const designNeeded = sfItems.filter((i) => i.productionStatus === "Design Needed");
  const designInProgress = sfItems.filter((i) => i.productionStatus === "Design In Progress");
  const readyToLaser = sfItems.filter((i) => i.productionStatus === "Ready to Laser");
  const inProduction = sfItems.filter((i) => i.productionStatus === "In Production");
  const readyToShip = sfItems.filter((i) => i.productionStatus === "Ready to Ship");

  return (
    <PageShell title="Order Queue" subtitle="Fulfillment pipeline \u2014 Salesforce + ShipStation">
      <div className="stat-grid">
        <StatBlock
          label="Needs Decision"
          value={sfStats.needsDecision || 0}
          note="Awaiting triage"
          accent="var(--status-red)"
        />
        <StatBlock
          label="In Production"
          value={(sfStats.readyToLaser || 0) + (sfStats.inProduction || 0)}
          note={`${sfStats.readyToLaser || 0} laser \u00b7 ${sfStats.inProduction || 0} active`}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Ready to Ship"
          value={(sfStats.readyToShip || 0) + ssAwaiting.length}
          note={`${sfStats.readyToShip || 0} SF \u00b7 ${ssAwaiting.length} ShipStation`}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Total Orders"
          value={(sfStats.totalPaid || 0) + (sfStats.totalDonated || 0)}
          note={`${sfStats.totalPaid || 0} paid \u00b7 ${sfStats.totalDonated || 0} donated`}
          accent="var(--gold)"
        />
      </div>

      {reconciled && reconciled.updated > 0 && (
        <div className="section">
          <DataCard title="Auto-Reconciliation">
            <div style={{ fontSize: 13, color: "var(--status-green)" }}>
              {"\u2705"} Synced {reconciled.updated} items with ShipStation — marked as shipped.
            </div>
          </DataCard>
        </div>
      )}

      {ssError && (
        <div className="section">
          <DataCard title="ShipStation Connection">
            <div style={{ color: "var(--status-red)", fontSize: 13 }}>
              ShipStation error: {ssError}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4 }}>
              Check SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET in environment variables.
            </div>
          </DataCard>
        </div>
      )}

      {needsDecision.length > 0 && (
        <div className="section">
          <DataCard title={`Needs Decision (${needsDecision.length})`}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              New orders awaiting triage. Decide: pre-made pull, laser production, or design needed.
            </div>
            <OrderItemTable items={needsDecision} />
          </DataCard>
        </div>
      )}

      {(designNeeded.length > 0 || designInProgress.length > 0) && (
        <div className="section">
          <DataCard title={`Design Pipeline (${designNeeded.length + designInProgress.length})`}>
            <OrderItemTable items={[...designNeeded, ...designInProgress]} />
          </DataCard>
        </div>
      )}

      {(readyToLaser.length > 0 || inProduction.length > 0) && (
        <div className="section">
          <DataCard title={`Laser Production (${readyToLaser.length + inProduction.length})`}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
              Ready to burn or actively in production. Max 3 per run.
            </div>
            <OrderItemTable items={[...readyToLaser, ...inProduction]} />
          </DataCard>
        </div>
      )}

      {readyToShip.length > 0 && (
        <div className="section">
          <DataCard title={`Ready to Ship \u2014 SF (${readyToShip.length})`}>
            <OrderItemTable items={readyToShip} />
          </DataCard>
        </div>
      )}

      <div className="section">
        <DataCard title={`Awaiting Shipment \u2014 ShipStation (${ssAwaiting.length})`}>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            Live from ShipStation. Print labels, pack, and ship.
          </div>
          <ShipStationTable orders={ssAwaiting} />
        </DataCard>
      </div>

      <div className="section">
        <DataCard title={`Recently Shipped (${ssRecent.length})`}>
          {ssRecent.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={thStyle}>Order #</th>
                    <th style={thStyle}>Ship To</th>
                    <th style={thStyle}>Tracking</th>
                    <th style={thStyle}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ssRecent.map((o) => (
                    <tr key={o.orderNumber} style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--text-bright)" }}>{o.orderNumber}</td>
                      <td style={tdStyle}>
                        <div style={{ fontSize: 12, color: "var(--text-bright)" }}>{o.shipTo?.name}</div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                        {o.trackingNumber || "\u2014"}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-bright)" }}>
                        {o.orderTotal ? `$${o.orderTotal.toFixed(2)}` : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "16px 0", color: "var(--text-dim)", fontSize: 13 }}>No recent shipments.</div>
          )}
        </DataCard>
      </div>

      <div className="section">
        <DataCard title="Daily Fulfillment Checklist">
          <ol style={{ margin: 0, padding: "0 0 0 20px", fontSize: 13, lineHeight: 2 }}>
            <li style={{ color: "var(--text-bright)" }}>Check <b>Needs Decision</b> above \u2014 triage new orders (pre-made pull, laser, or design needed)</li>
            <li style={{ color: "var(--text-bright)" }}>Check for new donated requests (email, IG, referrals)</li>
            <li style={{ color: "var(--text-bright)" }}>Orders needing design \u2192 assign to Ryan in Design Queue</li>
            <li style={{ color: "var(--text-bright)" }}>Orders ready to laser \u2192 batch for production (max 3 per run)</li>
            <li style={{ color: "var(--text-bright)" }}>Ready to ship \u2192 create ShipStation order, print labels, pack & ship</li>
            <li style={{ color: "var(--text-bright)" }}>Update SF fulfillment status for shipped orders</li>
          </ol>
        </DataCard>
      </div>
    </PageShell>
  );
}

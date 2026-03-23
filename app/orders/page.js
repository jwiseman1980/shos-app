export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import { getOrderStats } from "@/lib/shipstation";

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "top" };
const thStyle = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-dim)",
  textAlign: "left",
};

function AgeBadge({ days }) {
  const color =
    days >= 7
      ? "var(--status-red)"
      : days >= 3
      ? "var(--status-orange)"
      : "var(--status-green)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: color + "22",
        color: color,
      }}
    >
      {days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}
    </span>
  );
}

export default async function OrdersPage() {
  let stats = { awaitingCount: 0, awaitingOrders: [], recentShipped: [], error: null };

  try {
    stats = await getOrderStats();
  } catch (err) {
    stats.error = err.message;
  }

  return (
    <PageShell
      title="Order Queue"
      subtitle="Fulfillment pipeline — live from ShipStation"
    >
      {/* KPIs */}
      <div className="stat-grid">
        <StatBlock
          label="Awaiting Shipment"
          value={stats.awaitingCount}
          note="Orders ready to ship"
          accent={stats.awaitingCount > 0 ? "var(--status-orange)" : "var(--status-green)"}
        />
        <StatBlock
          label="Recently Shipped"
          value={stats.recentShipped.length}
          note="Last 5 shipments"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Oldest Order"
          value={
            stats.awaitingOrders.length > 0
              ? `${Math.max(...stats.awaitingOrders.map((o) => o.age))}d`
              : "\u2014"
          }
          note={stats.awaitingOrders.length > 0 ? "Days waiting" : "All clear"}
          accent={
            stats.awaitingOrders.some((o) => o.age >= 7)
              ? "var(--status-red)"
              : "var(--status-green)"
          }
        />
        <StatBlock
          label="Source"
          value="Live"
          note="ShipStation API"
          accent="var(--gold)"
        />
      </div>

      {/* Error State */}
      {stats.error && (
        <div className="section">
          <DataCard title="Connection Error">
            <div style={{ color: "var(--status-red)", fontSize: 13, padding: "8px 0" }}>
              {stats.error}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
              Check SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET in environment variables.
            </div>
          </DataCard>
        </div>
      )}

      {/* Awaiting Shipment */}
      <div className="section">
        <DataCard title={`Awaiting Shipment (${stats.awaitingCount})`}>
          {stats.awaitingOrders.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={thStyle}>Order</th>
                    <th style={thStyle}>Age</th>
                    <th style={thStyle}>Items</th>
                    <th style={thStyle}>Ship To</th>
                    <th style={thStyle}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.awaitingOrders.map((order) => (
                    <tr
                      key={order.orderId}
                      style={{ borderBottom: "1px solid var(--card-border)" }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>
                          #{order.orderNumber}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {new Date(order.orderDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <AgeBadge days={order.age} />
                      </td>
                      <td style={tdStyle}>
                        {order.items.map((item, i) => (
                          <div key={i} style={{ marginBottom: 2 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "monospace",
                                color: "var(--text-dim)",
                                marginRight: 6,
                              }}
                            >
                              {item.sku || "\u2014"}
                            </span>
                            <span style={{ color: "var(--text-bright)", fontSize: 12 }}>
                              {item.name}
                            </span>
                            {item.quantity > 1 && (
                              <span
                                style={{
                                  marginLeft: 4,
                                  fontSize: 11,
                                  color: "var(--status-blue)",
                                  fontWeight: 600,
                                }}
                              >
                                \u00d7{item.quantity}
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-bright)" }}>
                        {order.shipTo}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-bright)", fontWeight: 500 }}>
                        {order.orderTotal > 0
                          ? `$${order.orderTotal.toFixed(2)}`
                          : "Donated"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "16px 0", color: "var(--text-dim)", fontSize: 13 }}>
              {stats.error
                ? "Unable to fetch orders \u2014 check connection."
                : "All orders shipped! \ud83c\udf89"}
            </div>
          )}
        </DataCard>
      </div>

      {/* Recently Shipped */}
      <div className="section">
        <DataCard title="Recently Shipped">
          {stats.recentShipped.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={thStyle}>Order</th>
                    <th style={thStyle}>Ship Date</th>
                    <th style={thStyle}>Ship To</th>
                    <th style={thStyle}>Tracking</th>
                    <th style={thStyle}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentShipped.map((order) => (
                    <tr
                      key={order.orderId}
                      style={{ borderBottom: "1px solid var(--card-border)" }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--text-bright)" }}>
                        #{order.orderNumber}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-dim)" }}>
                        {order.shipDate
                          ? new Date(order.shipDate).toLocaleDateString()
                          : "\u2014"}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-bright)" }}>
                        {order.shipTo}
                      </td>
                      <td style={tdStyle}>
                        {order.trackingNumber ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: "monospace",
                              color: "var(--status-blue)",
                            }}
                          >
                            {order.trackingNumber}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>\u2014</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-bright)", fontWeight: 500 }}>
                        {order.orderTotal > 0
                          ? `$${order.orderTotal.toFixed(2)}`
                          : "Donated"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "16px 0", color: "var(--text-dim)", fontSize: 13 }}>
              No recent shipments.
            </div>
          )}
        </DataCard>
      </div>

      {/* Daily Checklist */}
      <div className="section">
        <DataCard title="Daily Fulfillment Checklist">
          <ol style={{ margin: 0, padding: "0 0 0 20px", fontSize: 13, lineHeight: 2 }}>
            <li style={{ color: "var(--text-bright)" }}>
              Check awaiting shipment orders above \u2014 anything over 3 days needs attention
            </li>
            <li style={{ color: "var(--text-bright)" }}>
              Check for new donated requests (email, IG, referrals)
            </li>
            <li style={{ color: "var(--text-bright)" }}>
              Orders needing design \u2192 assign to Ryan in Design Queue
            </li>
            <li style={{ color: "var(--text-bright)" }}>
              Orders ready to laser \u2192 batch for production (max 3 per run)
            </li>
            <li style={{ color: "var(--text-bright)" }}>
              Ready to ship \u2192 print labels in ShipStation, pack and ship
            </li>
            <li style={{ color: "var(--text-bright)" }}>
              Update SF fulfillment status for shipped orders
            </li>
          </ol>
        </DataCard>
      </div>
    </PageShell>
  );
}

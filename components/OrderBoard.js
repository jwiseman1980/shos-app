"use client";

import { useState } from "react";

const statusColors = {
  "Needs Decision": { bg: "#ef444422", text: "#ef4444", label: "Needs Decision" },
  "Design Needed": { bg: "#f59e0b22", text: "#f59e0b", label: "Design Needed" },
  "Design In Progress": { bg: "#8b5cf622", text: "#8b5cf6", label: "Design In Progress" },
  "Ready to Laser": { bg: "#3b82f622", text: "#3b82f6", label: "Ready to Laser" },
  "In Production": { bg: "#06b6d422", text: "#06b6d4", label: "In Production" },
  "Ready to Ship": { bg: "#22c55e22", text: "#22c55e", label: "Ready to Ship" },
};

const STATUS_OPTIONS = [
  "Needs Decision",
  "Design Needed",
  "Design In Progress",
  "Ready to Laser",
  "In Production",
  "Ready to Ship",
  "Shipped",
];

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

function OrderCard({ order, onItemStatusChange, section = "default" }) {
  const [expanded, setExpanded] = useState(true);
  const [updating, setUpdating] = useState({});

  const handleStatusChange = async (itemId, newStatus) => {
    setUpdating((prev) => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success && onItemStatusChange) {
        onItemStatusChange(order.id, itemId, newStatus);
      }
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setUpdating((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // Determine overall order status from worst item status
  const worstStatus = order.items.reduce((worst, item) => {
    const idx = STATUS_OPTIONS.indexOf(item.productionStatus);
    const worstIdx = STATUS_OPTIONS.indexOf(worst);
    return idx < worstIdx ? item.productionStatus : worst;
  }, "Shipped");

  const isDonated = order.orderType === "Donated";
  const itemCount = order.items.reduce((sum, i) => sum + (i.quantity || 1), 0);

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8,
      marginBottom: 12,
      overflow: "hidden",
      borderLeft: isDonated ? "3px solid var(--gold)" : "3px solid var(--card-border)",
    }}>
      {/* Order Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, color: "var(--text-dim)" }}>
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)" }}>
                {order.name}
              </span>
              {isDonated && (
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 8,
                  background: "var(--gold)", color: "#000", fontWeight: 700,
                }}>
                  DONATED
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              {order.customerName}
              {order.shipTo && <span> {"\u00b7"} {order.shipTo}</span>}
              {order.orderDate && (
                <span> {"\u00b7"} {new Date(order.orderDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {order.items.length} item{order.items.length > 1 ? "s" : ""} {"\u00b7"} {itemCount} bracelet{itemCount > 1 ? "s" : ""}
          </span>
          {order.orderTotal > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
              ${order.orderTotal.toFixed(2)}
            </span>
          )}
          <StatusBadge status={worstStatus} />
        </div>
      </div>

      {/* Order Items */}
      {expanded && (
        <div style={{
          borderTop: "1px solid var(--card-border)",
          padding: "0 16px 12px",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>SKU</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
                <th style={thStyle}>Size</th>
                {section !== "ship" && (
                  <th style={thStyle}>{section === "laser" ? "SVG" : "Design"}</th>
                )}
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: "var(--text-bright)" }}>{item.name}</span>
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
                  {section !== "ship" && (
                    <td style={tdStyle}>
                      {section === "laser" ? (
                        item.designUrl ? (
                          <a href={item.designUrl} target="_blank" rel="noopener"
                            style={{ color: "var(--status-green)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                            {"\u2B07"} Download
                          </a>
                        ) : (
                          <span style={{ color: "var(--status-green)", fontSize: 11 }}>In SF</span>
                        )
                      ) : (
                        item.hasDesign ? (
                          <span style={{ color: "var(--status-green)", fontSize: 12 }}>{"\u2713"}</span>
                        ) : (
                          <span style={{ color: "var(--status-orange)", fontSize: 11 }}>Needed</span>
                        )
                      )}
                    </td>
                  )}
                  <td style={tdStyle}>
                    <select
                      value={item.productionStatus}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      disabled={updating[item.id]}
                      style={{
                        background: "var(--bg)",
                        color: statusColors[item.productionStatus]?.text || "var(--text-bright)",
                        border: "1px solid var(--card-border)",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        opacity: updating[item.id] ? 0.5 : 1,
                      }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "middle" };
const thStyle = {
  padding: "8px 12px", fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", textAlign: "left",
};

export default function OrderBoard({ orders: initialOrders = [] }) {
  const [orders, setOrders] = useState(initialOrders);

  const handleItemStatusChange = (orderId, itemId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          items: o.items.map((i) =>
            i.id === itemId ? { ...i, productionStatus: newStatus } : i
          ),
        };
      }).filter((o) => {
        // Remove orders where all items are shipped
        if (newStatus === "Shipped") {
          return o.items.some((i) => i.productionStatus !== "Shipped");
        }
        return true;
      })
    );
  };

  // Group orders by worst status
  const needsDecision = orders.filter((o) =>
    o.items.some((i) => i.productionStatus === "Needs Decision")
  );
  const inDesign = orders.filter((o) =>
    !o.items.some((i) => i.productionStatus === "Needs Decision") &&
    o.items.some((i) => i.productionStatus === "Design Needed" || i.productionStatus === "Design In Progress")
  );
  const inProduction = orders.filter((o) =>
    !o.items.some((i) => ["Needs Decision", "Design Needed", "Design In Progress"].includes(i.productionStatus)) &&
    o.items.some((i) => i.productionStatus === "Ready to Laser" || i.productionStatus === "In Production")
  );
  const readyToShip = orders.filter((o) =>
    !o.items.some((i) => ["Needs Decision", "Design Needed", "Design In Progress", "Ready to Laser", "In Production"].includes(i.productionStatus)) &&
    o.items.some((i) => i.productionStatus === "Ready to Ship")
  );

  return (
    <div>
      {needsDecision.length > 0 && (
        <Section title={`Needs Decision (${needsDecision.length})`} color="#ef4444">
          {needsDecision.map((o) => (
            <OrderCard key={o.id} order={o} onItemStatusChange={handleItemStatusChange} />
          ))}
        </Section>
      )}

      {inDesign.length > 0 && (
        <Section title={`In Design (${inDesign.length})`} color="#f59e0b">
          {inDesign.map((o) => (
            <OrderCard key={o.id} order={o} onItemStatusChange={handleItemStatusChange} />
          ))}
        </Section>
      )}

      {inProduction.length > 0 && (
        <Section title={`Laser Queue (${inProduction.length})`} color="#3b82f6">
          {inProduction.map((o) => (
            <OrderCard key={o.id} order={o} onItemStatusChange={handleItemStatusChange} section="laser" />
          ))}
        </Section>
      )}

      {readyToShip.length > 0 && (
        <Section title={`Ready to Ship (${readyToShip.length})`} color="#22c55e">
          {readyToShip.map((o) => (
            <OrderCard key={o.id} order={o} onItemStatusChange={handleItemStatusChange} section="ship" />
          ))}
        </Section>
      )}

      {orders.length === 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--status-green)", fontSize: 14 }}>
          {"\u2713"} All orders fulfilled. Nothing in the pipeline.
        </div>
      )}
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{
        fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
        color, marginBottom: 12, paddingBottom: 6,
        borderBottom: `2px solid ${color}22`,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

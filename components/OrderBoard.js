"use client";

import { useState } from "react";

const statusColors = {
  "not_started": { bg: "#f59e0b22", text: "#f59e0b", label: "Design Needed" },
  "design_needed": { bg: "#f59e0b22", text: "#f59e0b", label: "Design Needed" },
  "ready_to_laser": { bg: "#3b82f622", text: "#3b82f6", label: "Ready to Laser" },
  "in_production": { bg: "#06b6d422", text: "#06b6d4", label: "In Production" },
  "ready_to_ship": { bg: "#22c55e22", text: "#22c55e", label: "Ready to Ship" },
  "shipped": { bg: "#6b728022", text: "#6b7280", label: "Shipped" },
};

// Only valid Supabase enum values
const STATUS_OPTIONS = [
  "design_needed",
  "ready_to_laser",
  "in_production",
  "ready_to_ship",
  "shipped",
];

function StatusBadge({ status }) {
  const c = statusColors[status] || { bg: "#6b728022", text: "#6b7280", label: status };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {c.label}
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
  // Map legacy statuses to design_needed for display
  const normalizeStatus = (s) => s === "not_started" ? "design_needed" : s;
  const worstStatus = order.items.reduce((worst, item) => {
    const status = normalizeStatus(item.productionStatus);
    const idx = STATUS_OPTIONS.indexOf(status);
    const worstIdx = STATUS_OPTIONS.indexOf(worst);
    return idx < worstIdx ? status : worst;
  }, "shipped");

  const isDonated = order.orderType === "donated";
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
                {order.name || order.orderNumber}
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
          {(order.orderTotal > 0 || order.items.some(i => i.unitPrice > 0)) && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
              ${(order.orderTotal || order.items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0)).toFixed(2)}
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
                    {item.size === "Regular-7in" || item.size === "7" ? '7"' : item.size === "Small-6in" || item.size === "6" ? '6"' : item.size || "\u2014"}
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
                        <option key={s} value={s}>{statusColors[s]?.label || s}</option>
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
        if (newStatus === "shipped") {
          return o.items.some((i) => i.productionStatus !== "shipped");
        }
        return true;
      })
    );
  };

  // Group orders by worst item status into pipeline stages
  // "not_started" items are pre-triage, treated same as "design_needed"
  const designStatuses = ["not_started", "design_needed"];
  const laserStatuses = ["ready_to_laser", "in_production"];

  const inDesign = orders.filter((o) =>
    o.items.some((i) => designStatuses.includes(i.productionStatus))
  );
  const inProduction = orders.filter((o) =>
    !o.items.some((i) => designStatuses.includes(i.productionStatus)) &&
    o.items.some((i) => laserStatuses.includes(i.productionStatus))
  );
  const readyToShip = orders.filter((o) =>
    !o.items.some((i) => [...designStatuses, ...laserStatuses].includes(i.productionStatus)) &&
    o.items.some((i) => i.productionStatus === "ready_to_ship")
  );

  return (
    <div>
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

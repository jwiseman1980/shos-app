"use client";

import { useState } from "react";

export default function ShippingQueue({ orders: initialOrders = [] }) {
  const [orders, setOrders] = useState(initialOrders);

  if (orders.length === 0) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u2705"}</div>
        <div style={{ fontSize: 15, color: "var(--status-green)", fontWeight: 600 }}>All shipped!</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>Nothing waiting to go out.</div>
      </div>
    );
  }

  // Sort by age — oldest first
  const sorted = [...orders].sort(
    (a, b) => new Date(a.orderDate) - new Date(b.orderDate)
  );

  return (
    <div>
      {sorted.map((order) => {
        const age = order.orderDate
          ? Math.floor((Date.now() - new Date(order.orderDate).getTime()) / 86400000)
          : 0;
        const ageColor = age >= 7 ? "#ef4444" : age >= 3 ? "#f59e0b" : "#22c55e";
        const isDonated = order.orderNumber?.startsWith("DON");
        const totalItems = order.items.reduce((s, i) => s + (i.quantity || 1), 0);

        return (
          <div
            key={order.orderNumber}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderLeft: isDonated ? "3px solid var(--gold)" : "3px solid var(--card-border)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)" }}>
                    {order.orderNumber}
                  </span>
                  {isDonated && (
                    <span style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 8,
                      background: "var(--gold)", color: "#000", fontWeight: 700,
                    }}>
                      DONATED
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: ageColor }}>
                    {age}d old
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-bright)", marginTop: 4 }}>
                  {"\u{1F4E6}"} {order.shipTo?.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                  {[order.shipTo?.street1, order.shipTo?.city, order.shipTo?.state, order.shipTo?.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {order.orderTotal > 0 && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)" }}>
                    ${order.orderTotal.toFixed(2)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {totalItems} bracelet{totalItems > 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{
              background: "var(--bg)",
              borderRadius: 6,
              padding: "8px 12px",
              marginBottom: 12,
            }}>
              {order.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderBottom: i < order.items.length - 1 ? "1px solid var(--card-border)" : "none",
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-bright)" }}>{item.name || item.sku}</span>
                  <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>{item.sku}</span>
                    <span style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 600 }}>x{item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <a
                href={`https://ship.shipstation.com/orders/awaiting-shipment`}
                target="_blank"
                rel="noopener"
                style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: 6, border: "none", cursor: "pointer",
                  background: "#3b82f622", color: "#3b82f6",
                  textDecoration: "none",
                }}
              >
                {"\u{1F5A8}"} Print Label in ShipStation
              </a>
              {order.customerEmail && (
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {order.customerEmail}
                </span>
              )}
            </div>

            {/* Notes */}
            {order.internalNotes && (
              <div style={{
                fontSize: 11, color: "var(--text-dim)", marginTop: 8,
                fontStyle: "italic",
              }}>
                Note: {order.internalNotes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

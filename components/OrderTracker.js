"use client";

import { useState, useCallback } from "react";

const STATUS_FLOW = [
  "Intake",
  "Design Needed",
  "Ready to Laser",
  "Produced",
  "Ready to Ship",
  "Shipped",
  "Complete",
  "Cancelled",
];

const STATUS_COLORS = {
  Intake: "var(--status-blue)",
  "Design Needed": "var(--status-orange)",
  "Ready to Laser": "var(--gold)",
  Produced: "var(--status-green)",
  "Ready to Ship": "var(--status-green)",
  Shipped: "var(--status-green)",
  Complete: "var(--text-dim)",
  Cancelled: "var(--status-red)",
};

const TYPE_COLORS = {
  Donated: "var(--status-blue)",
  Paid: "var(--status-green)",
  Commission: "var(--status-purple)",
};

function OrderRow({ order, onStatusChange, onAddDesignTask }) {
  const [status, setStatus] = useState(order.status || "Intake");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: order.id, status: newStatus }),
      });
      const data = await res.json();
      setLastSaved(data.success ? "saved" : data.mock ? "offline" : "error");
      if (onStatusChange) onStatusChange(order.id, newStatus);
    } catch {
      setLastSaved("error");
    } finally {
      setSaving(false);
      setTimeout(() => setLastSaved(null), 2000);
    }
  };

  const needsDesign = status === "Design Needed";
  const isShipped = status === "Shipped" || status === "Complete";

  return (
    <tr
      style={{
        opacity: isShipped ? 0.6 : 1,
        background: saving
          ? "rgba(212, 175, 55, 0.04)"
          : lastSaved === "saved"
          ? "rgba(34, 197, 94, 0.04)"
          : "transparent",
        transition: "background 0.3s ease",
      }}
    >
      <td>
        <span style={{ fontWeight: 500, color: "var(--text-bright)", fontSize: 12 }}>
          {order.orderName || "—"}
        </span>
      </td>
      <td>{order.heroName || "—"}</td>
      <td>{order.recipientName || "—"}</td>
      <td>
        <span
          style={{
            display: "inline-block",
            padding: "2px 6px",
            borderRadius: "var(--radius-sm)",
            fontSize: 10,
            fontWeight: 600,
            background: `${TYPE_COLORS[order.orderType] || "var(--card-border)"}22`,
            color: TYPE_COLORS[order.orderType] || "var(--text-dim)",
            border: `1px solid ${TYPE_COLORS[order.orderType] || "var(--card-border)"}44`,
          }}
        >
          {order.orderType || "—"}
        </span>
      </td>
      <td style={{ textAlign: "center" }}>{order.quantity || "—"}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select
            value={status}
            onChange={handleStatusChange}
            style={{
              background: "var(--bg)",
              color: STATUS_COLORS[status] || "var(--text-bright)",
              border: `1px solid ${STATUS_COLORS[status] || "var(--card-border)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "3px 6px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {saving && <span style={{ fontSize: 10, color: "var(--gold)" }}>saving...</span>}
          {lastSaved === "saved" && <span style={{ fontSize: 10, color: "var(--status-green)" }}>✓</span>}
          {lastSaved === "offline" && <span style={{ fontSize: 10, color: "var(--status-orange)" }}>offline</span>}
          {lastSaved === "error" && <span style={{ fontSize: 10, color: "var(--status-red)" }}>failed</span>}
        </div>
      </td>
      <td>{order.fulfillmentMethod || "—"}</td>
      <td>
        {order.trackingNumber ? (
          <span style={{ fontSize: 11, color: "var(--status-green)" }}>{order.trackingNumber}</span>
        ) : isShipped ? (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
        ) : needsDesign ? (
          <button
            onClick={() => onAddDesignTask && onAddDesignTask(order)}
            style={{
              background: "var(--status-purple)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Design Task
          </button>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
        )}
      </td>
    </tr>
  );
}

export default function OrderTracker({ orders, onAddDesignTask }) {
  const [orderData, setOrderData] = useState(orders);

  const handleStatusChange = useCallback((id, newStatus) => {
    setOrderData((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );
  }, []);

  if (orderData.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
        No orders found. Orders are created from Salesforce purchases and donated bracelet requests.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Hero</th>
            <th>Recipient</th>
            <th>Type</th>
            <th style={{ textAlign: "center" }}>Qty</th>
            <th>Status</th>
            <th>Method</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orderData.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              onAddDesignTask={onAddDesignTask}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState } from "react";

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "middle" };
const thStyle = { padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", textAlign: "left" };

export default function LaserQueue({ items: initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [updating, setUpdating] = useState({});

  const handleDone = async (itemId, itemName) => {
    // Confirmation before advancing to ship queue
    if (!window.confirm(`Mark "${itemName}" as done and move to shipping queue?`)) {
      return;
    }
    await updateStatus(itemId, "ready_to_ship", itemName);
  };

  const handleMoveBack = async (itemId, itemName) => {
    if (!window.confirm(`Move "${itemName}" back to Design Queue?`)) {
      return;
    }
    await updateStatus(itemId, "design_needed", itemName);
  };

  const updateStatus = async (itemId, status, itemName) => {
    setUpdating((prev) => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status, heroName: itemName }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setUpdating((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "var(--status-green)", fontSize: 13 }}>
        {"\u2713"} Laser queue empty — nothing to burn.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
            <th style={thStyle}>Item</th>
            <th style={thStyle}>SKU</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
            <th style={thStyle}>Size</th>
            <th style={thStyle}>SVG</th>
            <th style={thStyle}>Customer</th>
            <th style={thStyle}>Order</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            // Use full SKU (with size) for download so correct size variant is served
            const downloadUrl = item.sku ? `/api/designs/download?sku=${encodeURIComponent(item.sku)}` : "";
            return (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500, color: "var(--text-bright)" }}>{item.name}</div>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                    {item.sku || "\u2014"}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: "center", color: "var(--text-bright)" }}>{item.quantity}</td>
                <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                  {item.size === "Regular-7in" ? '7"' : item.size === "Small-6in" ? '6"' : item.size || "\u2014"}
                </td>
                <td style={tdStyle}>
                  <a href={downloadUrl} target="_blank" rel="noopener"
                    style={{ color: "var(--status-green)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                    {"\u2B07"} Download
                  </a>
                </td>
                <td style={tdStyle}>
                  <div style={{ fontSize: 12, color: "var(--text-bright)" }}>{item.customerName}</div>
                  {item.shipTo && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.shipTo}</div>}
                </td>
                <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-dim)" }}>{item.orderName}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleMoveBack(item.id, item.name)}
                      disabled={updating[item.id]}
                      title="Move back to design queue"
                      style={{
                        padding: "5px 10px", fontSize: 11, fontWeight: 600,
                        borderRadius: 6, border: "1px solid #6b7280", cursor: "pointer",
                        background: "transparent", color: "#6b7280",
                        opacity: updating[item.id] ? 0.5 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {"\u2190"} Back
                    </button>
                    <button
                      onClick={() => handleDone(item.id, item.name)}
                      disabled={updating[item.id]}
                      style={{
                        padding: "5px 14px", fontSize: 11, fontWeight: 600,
                        borderRadius: 6, border: "1px solid #2563eb", cursor: "pointer",
                        background: "#2563eb", color: "#fff",
                        opacity: updating[item.id] ? 0.5 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {updating[item.id] ? "Saving..." : "Mark Done"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

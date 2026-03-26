"use client";

import { useState } from "react";

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "middle" };
const thStyle = { padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", textAlign: "left" };

export default function LaserQueue({ items: initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [updating, setUpdating] = useState({});

  const handleDone = async (itemId, itemName) => {
    setUpdating((prev) => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: "Ready to Ship", heroName: itemName }),
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
            const baseSku = (item.sku || "").replace(/-[67]$/, "").replace(/-[67]D$/, "").replace(/_-D$/, "").replace(/-D$/, "");
            const downloadUrl = baseSku ? `/api/designs/download?sku=${encodeURIComponent(baseSku)}` : "";
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
                  <button
                    onClick={() => handleDone(item.id, item.name)}
                    disabled={updating[item.id]}
                    style={{
                      padding: "5px 12px", fontSize: 11, fontWeight: 600,
                      borderRadius: 6, border: "none", cursor: "pointer",
                      background: "#22c55e22", color: "#22c55e",
                      opacity: updating[item.id] ? 0.5 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {updating[item.id] ? "..." : "\u2713 Done"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

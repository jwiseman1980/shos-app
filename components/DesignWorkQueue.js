"use client";

import { useState, useCallback, useRef } from "react";

const sizeLabel = (s) => {
  if (s === "Regular-7in" || s === "7") return '7"';
  if (s === "Small-6in" || s === "6") return '6"';
  return s || "\u2014";
};

export default function DesignWorkQueue({ items: initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [uploading, setUploading] = useState({});
  const [uploadResult, setUploadResult] = useState({});
  const [advancing, setAdvancing] = useState({});
  const fileInputRefs = useRef({});

  const needDesign = items.filter((i) => !i.hasDesign);
  const hasDesign = items.filter((i) => i.hasDesign);

  const handleUpload = useCallback(async (item, file) => {
    if (!file || !file.name.endsWith(".svg")) {
      setUploadResult((prev) => ({ ...prev, [item.itemId]: { error: "Only .svg files accepted" } }));
      return;
    }

    setUploading((prev) => ({ ...prev, [item.itemId]: true }));
    setUploadResult((prev) => ({ ...prev, [item.itemId]: null }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sku", item.sku);
      if (item.heroId) formData.append("heroId", item.heroId);

      const res = await fetch("/api/designs/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.error) {
        setUploadResult((prev) => ({ ...prev, [item.itemId]: { error: data.error } }));
      } else {
        // Auto-advance to ready_to_laser now that design exists
        try {
          await fetch("/api/orders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: item.itemId,
              status: "ready_to_laser",
              heroName: item.heroName || item.sku,
            }),
          });
        } catch (advErr) {
          console.warn("Auto-advance failed:", advErr.message);
        }

        setUploadResult((prev) => ({
          ...prev,
          [item.itemId]: { success: true, url: data.url, advanced: true },
        }));
        // Remove from queue — it's been advanced
        setItems((prev) => prev.filter((i) => i.itemId !== item.itemId));
      }
    } catch (err) {
      setUploadResult((prev) => ({ ...prev, [item.itemId]: { error: err.message } }));
    } finally {
      setUploading((prev) => ({ ...prev, [item.itemId]: false }));
    }
  }, []);

  const handleAdvanceToLaser = useCallback(async (item) => {
    setAdvancing((prev) => ({ ...prev, [item.itemId]: true }));
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId, status: "ready_to_laser" }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((i) => i.itemId !== item.itemId));
      }
    } catch (err) {
      console.error("Advance error:", err);
    } finally {
      setAdvancing((prev) => ({ ...prev, [item.itemId]: false }));
    }
  }, []);

  const handleMarkShipped = useCallback(async (item) => {
    setAdvancing((prev) => ({ ...prev, [item.itemId]: true }));
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId, status: "shipped" }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.filter((i) => i.itemId !== item.itemId));
      }
    } catch (err) {
      console.error("Ship error:", err);
    } finally {
      setAdvancing((prev) => ({ ...prev, [item.itemId]: false }));
    }
  }, []);

  return (
    <div>
      {/* Items that NEED designs — Ryan's work queue */}
      {needDesign.length > 0 && (
        <Section title={`Needs Design (${needDesign.length})`} color="#f59e0b">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Hero</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Size</th>
                <th style={thStyle}>Order</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Upload SVG</th>
              </tr>
            </thead>
            <tbody>
              {needDesign.map((item) => (
                <tr key={item.itemId} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: "var(--text-bright)" }}>
                      {item.heroName || item.sku}
                    </span>
                    {item.branch && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.branch}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                      {item.sku}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                    {sizeLabel(item.size)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      #{item.orderNumber}
                    </span>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {item.orderDate ? new Date(item.orderDate).toLocaleDateString() : ""}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                    {item.customerName}
                    {item.orderType === "donated" && (
                      <span style={{
                        fontSize: 9, padding: "1px 4px", borderRadius: 4, marginLeft: 6,
                        background: "var(--gold)", color: "#000", fontWeight: 700,
                      }}>
                        DON
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {uploading[item.itemId] ? (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Uploading...</span>
                    ) : uploadResult[item.itemId]?.success ? (
                      <span style={{ fontSize: 11, color: "var(--status-green)" }}>
                        {"\u2713"} Uploaded
                      </span>
                    ) : uploadResult[item.itemId]?.error ? (
                      <span style={{ fontSize: 11, color: "var(--status-red)" }}>
                        {uploadResult[item.itemId].error}
                      </span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          ref={(el) => fileInputRefs.current[item.itemId] = el}
                          type="file"
                          accept=".svg"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            if (e.target.files[0]) handleUpload(item, e.target.files[0]);
                          }}
                        />
                        <button
                          onClick={() => fileInputRefs.current[item.itemId]?.click()}
                          style={{
                            background: "var(--status-blue)22",
                            border: "1px solid var(--status-blue)",
                            color: "var(--status-blue)",
                            cursor: "pointer",
                            padding: "4px 12px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {"\u2191"} Upload SVG
                        </button>
                        <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace" }}>
                          {item.sku}.svg
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Items that HAVE designs — can advance to laser or mark shipped (in stock) */}
      {hasDesign.length > 0 && (
        <Section title={`Has Design \u2014 Ready to Advance (${hasDesign.length})`} color="#22c55e">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Hero</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Size</th>
                <th style={thStyle}>Order</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hasDesign.map((item) => (
                <tr key={item.itemId} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: "var(--text-bright)" }}>
                      {item.heroName || item.sku}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                      {item.sku}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                    {sizeLabel(item.size)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      #{item.orderNumber} {"\u00b7"} {item.customerName}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleAdvanceToLaser(item)}
                        disabled={advancing[item.itemId]}
                        style={{
                          background: "var(--status-blue)22",
                          border: "1px solid var(--status-blue)",
                          color: "var(--status-blue)",
                          cursor: "pointer",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          opacity: advancing[item.itemId] ? 0.5 : 1,
                        }}
                      >
                        {"\u2192"} Laser Queue
                      </button>
                      <button
                        onClick={() => handleMarkShipped(item)}
                        disabled={advancing[item.itemId]}
                        title="Already in stock — skip to shipped"
                        style={{
                          background: "var(--status-green)22",
                          border: "1px solid var(--status-green)",
                          color: "var(--status-green)",
                          cursor: "pointer",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          opacity: advancing[item.itemId] ? 0.5 : 1,
                        }}
                      >
                        {"\u2713"} In Stock
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {items.length === 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--status-green)", fontSize: 14 }}>
          {"\u2713"} All orders have designs. Nothing in the queue.
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
      <div style={{
        background: "var(--card-bg)", border: "1px solid var(--card-border)",
        borderRadius: 8, overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "middle" };
const thStyle = {
  padding: "8px 12px", fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", textAlign: "left",
};

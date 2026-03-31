"use client";

import { useState, useCallback, useRef } from "react";

const COLUMNS = [
  { key: "design_needed", label: "Design Needed", color: "var(--status-orange)" },
  { key: "ready_to_laser", label: "Ready to Laser", color: "var(--status-blue)" },
  { key: "in_production", label: "In Production", color: "#00bcd4" },
  { key: "ready_to_ship", label: "Ready to Ship", color: "var(--status-green)" },
  { key: "shipped", label: "Shipped", color: "var(--text-dim)" },
];

const NEXT_STATUS = {
  design_needed: "ready_to_laser",
  ready_to_laser: "ready_to_ship",
  in_production: "ready_to_ship",
  ready_to_ship: "shipped",
};

const ACTION_LABELS = {
  design_needed: null, // handled by upload
  ready_to_laser: "Mark Done",
  in_production: "Mark Done",
  ready_to_ship: "Mark Shipped",
};

const sizeLabel = (s) => {
  if (s === "7") return '7"';
  if (s === "6") return '6"';
  return s || "";
};

export default function ProductionBoard({ columns: initialColumns = {}, stats = {} }) {
  const [columns, setColumns] = useState(initialColumns);
  const [busy, setBusy] = useState({});
  const [uploading, setUploading] = useState({});
  const [uploadResult, setUploadResult] = useState({});
  const fileRefs = useRef({});

  const moveCard = useCallback(async (card, fromStatus, toStatus) => {
    const key = card.sku + "-" + fromStatus;
    setBusy((p) => ({ ...p, [key]: true }));

    try {
      // Advance ALL item IDs for this SKU
      for (const id of card.allItemIds) {
        await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: id, status: toStatus, heroName: card.heroName || card.sku }),
        });
      }

      // Optimistic UI: move card between columns
      setColumns((prev) => {
        const next = { ...prev };
        next[fromStatus] = (next[fromStatus] || []).filter((c) => c.sku !== card.sku);
        if (toStatus !== "shipped" || (next.shipped || []).length < 10) {
          next[toStatus] = [...(next[toStatus] || []), { ...card, status: toStatus }];
        }
        return next;
      });
    } catch (err) {
      console.error("Move failed:", err);
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
    }
  }, []);

  const handleUpload = useCallback(async (card, file) => {
    if (!file || !file.name.toLowerCase().endsWith(".svg")) {
      setUploadResult((p) => ({ ...p, [card.sku]: { error: "Only .svg files" } }));
      return;
    }

    setUploading((p) => ({ ...p, [card.sku]: true }));
    setUploadResult((p) => ({ ...p, [card.sku]: null }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sku", card.sku);
      if (card.heroId) formData.append("heroId", card.heroId);

      const res = await fetch("/api/designs/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setUploadResult((p) => ({ ...p, [card.sku]: { error: data.error } }));
        return;
      }

      // Auto-advance all items for this SKU to ready_to_laser
      for (const id of card.allItemIds) {
        await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: id, status: "ready_to_laser", heroName: card.heroName || card.sku }),
        });
      }

      setUploadResult((p) => ({ ...p, [card.sku]: { success: true } }));

      // Move card to ready_to_laser column
      setColumns((prev) => {
        const next = { ...prev };
        next.design_needed = (next.design_needed || []).filter((c) => c.sku !== card.sku);
        next.ready_to_laser = [...(next.ready_to_laser || []), { ...card, status: "ready_to_laser", hasDesign: true }];
        return next;
      });
    } catch (err) {
      setUploadResult((p) => ({ ...p, [card.sku]: { error: err.message } }));
    } finally {
      setUploading((p) => ({ ...p, [card.sku]: false }));
    }
  }, []);

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", minHeight: "calc(100vh - 200px)", paddingBottom: 24 }}>
      {COLUMNS.map((col) => {
        const cards = columns[col.key] || [];
        const count = col.key === "shipped"
          ? stats.totalShipped?.toLocaleString() || "0"
          : cards.length;

        return (
          <div key={col.key} style={{
            flex: col.key === "shipped" ? "0 0 220px" : "1 1 0",
            minWidth: 220,
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Column header */}
            <div style={{
              borderTop: `3px solid ${col.color}`,
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "8px 8px 0 0",
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: col.color }}>
                {col.label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                background: `${col.color}22`, color: col.color,
              }}>
                {count}
              </span>
            </div>

            {/* Cards container */}
            <div style={{
              flex: 1,
              background: "var(--bg-2)",
              border: "1px solid var(--card-border)",
              borderTop: "none",
              borderRadius: "0 0 8px 8px",
              padding: 8,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              overflowY: "auto",
            }}>
              {cards.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "var(--text-dim)" }}>
                  {col.key === "shipped" ? "Recent shipments" : "Empty"}
                </div>
              )}

              {cards.map((card) => (
                <Card
                  key={card.sku + "-" + col.key}
                  card={card}
                  column={col}
                  isBusy={busy[card.sku + "-" + col.key]}
                  isUploading={uploading[card.sku]}
                  uploadResult={uploadResult[card.sku]}
                  fileRef={(el) => fileRefs.current[card.sku] = el}
                  onClickFileInput={() => fileRefs.current[card.sku]?.click()}
                  onUpload={(file) => handleUpload(card, file)}
                  onAdvance={() => moveCard(card, col.key, NEXT_STATUS[col.key])}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ card, column, isBusy, isUploading, uploadResult, fileRef, onClickFileInput, onUpload, onAdvance }) {
  const isShipped = column.key === "shipped";
  const nextStatus = NEXT_STATUS[column.key];
  const actionLabel = ACTION_LABELS[column.key];

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8,
      padding: 10,
      borderLeft: card.orderType === "donated" ? "3px solid var(--gold)" : "none",
    }}>
      {/* Hero name */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4, lineHeight: 1.3 }}>
        {card.heroName || card.sku}
      </div>

      {/* SKU + size */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-dim)" }}>{card.sku}</span>
        {card.size && (
          <span style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 700,
            background: card.size === "6" ? "#8e44ad22" : "#3498db22",
            color: card.size === "6" ? "#8e44ad" : "#3498db",
          }}>
            {sizeLabel(card.size)}
          </span>
        )}
      </div>

      {/* Order info */}
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>
        <span>#{card.orderNumber}</span>
        {card.orderCount > 1 && (
          <span style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 4, marginLeft: 6,
            background: "var(--status-blue)22", color: "var(--status-blue)", fontWeight: 700,
          }}>
            +{card.orderCount - 1} more
          </span>
        )}
        {card.totalQty > 1 && (
          <span style={{ marginLeft: 6 }}>{card.totalQty} bracelets</span>
        )}
      </div>

      {/* Customer */}
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>
        {card.customers?.[0] || card.customerName}
        {card.orderCount > 1 && <span> + {card.orderCount - 1} other{card.orderCount > 2 ? "s" : ""}</span>}
      </div>

      {card.orderType === "donated" && (
        <div style={{
          fontSize: 9, display: "inline-block", padding: "1px 5px", borderRadius: 4,
          background: "var(--gold)22", color: "var(--gold)", fontWeight: 700, marginBottom: 8,
        }}>
          DONATED
        </div>
      )}

      {/* Shipped date for shipped column */}
      {isShipped && card.orderDate && (
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          {new Date(card.orderDate).toLocaleDateString()}
        </div>
      )}

      {/* Actions */}
      {!isShipped && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Design Needed: Upload button */}
          {column.key === "design_needed" && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".svg"
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }}
              />
              {isUploading ? (
                <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>Uploading...</div>
              ) : uploadResult?.success ? (
                <div style={{ fontSize: 11, color: "var(--status-green)", textAlign: "center" }}>Uploaded</div>
              ) : uploadResult?.error ? (
                <div style={{ fontSize: 11, color: "var(--status-red)" }}>{uploadResult.error}</div>
              ) : (
                <button onClick={onClickFileInput} style={uploadBtnStyle}>
                  Upload SVG
                </button>
              )}
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text-dim)", textAlign: "center" }}>
                {card.sku}.svg
              </div>
            </>
          )}

          {/* Ready to Laser: Download + Start */}
          {column.key === "ready_to_laser" && (
            <>
              <a
                href={`/api/designs/download?sku=${encodeURIComponent(card.sku)}`}
                download
                style={{ ...actionBtnStyle, background: "var(--status-blue)15", borderColor: "var(--status-blue)", color: "var(--status-blue)", textAlign: "center", textDecoration: "none", display: "block" }}
              >
                Download SVG
              </a>
              <button onClick={onAdvance} disabled={isBusy} style={{ ...actionBtnStyle, opacity: isBusy ? 0.5 : 1 }}>
                {isBusy ? "Moving..." : actionLabel}
              </button>
            </>
          )}

          {/* In Production / Ready to Ship: single advance button */}
          {(column.key === "in_production" || column.key === "ready_to_ship") && actionLabel && (
            <button onClick={onAdvance} disabled={isBusy} style={{ ...actionBtnStyle, opacity: isBusy ? 0.5 : 1 }}>
              {isBusy ? "Moving..." : actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const uploadBtnStyle = {
  background: "var(--status-orange)15",
  border: "1px solid var(--status-orange)",
  color: "var(--status-orange)",
  cursor: "pointer",
  padding: "6px 0",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  width: "100%",
};

const actionBtnStyle = {
  background: "var(--gold)15",
  border: "1px solid var(--gold)",
  color: "var(--gold)",
  cursor: "pointer",
  padding: "6px 0",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  width: "100%",
};

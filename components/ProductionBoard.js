"use client";

import { useState, useCallback, useRef } from "react";

// ─── Column config ──────────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: "not_started",
    label: "Queued",
    color: "var(--text-dim)",
    blocking: "Waiting on: triage (auto-runs on sync)",
    emptyText: "No new orders",
  },
  {
    key: "design_needed",
    label: "Design Needed",
    color: "var(--status-orange)",
    blocking: "Waiting on: Ryan — design file",
    emptyText: "No designs needed",
  },
  {
    key: "ready_to_laser",
    label: "Ready to Laser",
    color: "var(--status-blue)",
    blocking: "Waiting on: your laser time",
    emptyText: "Laser queue clear",
  },
  {
    key: "in_production",
    label: "In Production",
    color: "#00bcd4",
    blocking: "Active — you\u2019re making these",
    emptyText: "Nothing active",
  },
  {
    key: "ready_to_ship",
    label: "Ready to Ship",
    color: "var(--status-green)",
    blocking: "Waiting on: ShipStation label + Kristin",
    emptyText: "Nothing to ship",
  },
  {
    key: "shipped",
    label: "Shipped",
    color: "var(--text-dim)",
    blocking: null,
    emptyText: "No recent shipments",
  },
];

// ready_to_laser now goes to in_production first (not directly to ready_to_ship)
const NEXT_STATUS = {
  not_started: "design_needed",
  ready_to_laser: "in_production",
  in_production: "ready_to_ship",
  ready_to_ship: "shipped",
};

const ACTION_LABELS = {
  not_started: null,
  design_needed: null,
  ready_to_laser: "▶ Start Lasering",
  in_production: "✓ Mark Done",
  ready_to_ship: "📦 Mark Shipped",
};

const sizeLabel = (s) => {
  if (s === "7") return '7"';
  if (s === "6") return '6"';
  return s || "";
};

// ─── Main board ─────────────────────────────────────────────────────────────

export default function ProductionBoard({ columns: initialColumns = {}, stats = {} }) {
  const [columns, setColumns] = useState(initialColumns);
  const [busy, setBusy] = useState({});
  const [uploading, setUploading] = useState({});
  const [uploadResult, setUploadResult] = useState({});
  const [notifyResult, setNotifyResult] = useState({});
  const [pushResult, setPushResult] = useState({});
  const fileRefs = useRef({});

  const moveCard = useCallback(async (card, fromStatus, toStatus) => {
    const key = card.sku + "-" + fromStatus;
    setBusy((p) => ({ ...p, [key]: true }));

    try {
      for (const id of card.allItemIds) {
        await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: id, status: toStatus, heroName: card.heroName || card.sku }),
        });
      }

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

      for (const id of card.allItemIds) {
        await fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: id, status: "ready_to_laser", heroName: card.heroName || card.sku }),
        });
      }

      setUploadResult((p) => ({ ...p, [card.sku]: { success: true } }));

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

  const handleNotifyRyan = useCallback(async (card) => {
    const key = card.sku;
    setNotifyResult((p) => ({ ...p, [key]: "sending" }));
    try {
      const res = await fetch("/api/slack/notify-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: card.sku,
          heroName: card.heroName || card.sku,
          heroId: card.heroId,
          orderCount: card.orderCount,
        }),
      });
      const data = await res.json();
      setNotifyResult((p) => ({ ...p, [key]: data.error ? "error" : "sent" }));
      setTimeout(() => setNotifyResult((p) => ({ ...p, [key]: null })), 3000);
    } catch {
      setNotifyResult((p) => ({ ...p, [key]: "error" }));
      setTimeout(() => setNotifyResult((p) => ({ ...p, [key]: null })), 3000);
    }
  }, []);

  const handlePushShipStation = useCallback(async (card) => {
    const key = card.sku;
    setPushResult((p) => ({ ...p, [key]: "pushing" }));
    // Push all parent orders for this SKU group
    const orderIds = card.allOrderIds || [];
    if (orderIds.length === 0) {
      setPushResult((p) => ({ ...p, [key]: "No order ID found" }));
      setTimeout(() => setPushResult((p) => ({ ...p, [key]: null })), 4000);
      return;
    }
    let anyError = null;
    for (const orderId of orderIds) {
      try {
        const res = await fetch("/api/orders/push-shipstation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (!data.success) anyError = data.error;
      } catch (err) {
        anyError = err.message;
      }
    }
    setPushResult((p) => ({ ...p, [key]: anyError || "pushed" }));
    setTimeout(() => setPushResult((p) => ({ ...p, [key]: null })), 5000);
    if (!anyError) {
      moveCard(card, "ready_to_ship", "shipped");
    }
  }, [moveCard]);

  return (
    <div style={{
      display: "flex",
      gap: 10,
      overflowX: "auto",
      minHeight: "calc(100vh - 220px)",
      paddingBottom: 24,
      alignItems: "flex-start",
    }}>
      {COLUMNS.map((col) => {
        const cards = columns[col.key] || [];
        const count = col.key === "shipped"
          ? stats.totalShipped?.toLocaleString() || "0"
          : cards.length;

        return (
          <Column
            key={col.key}
            col={col}
            cards={cards}
            count={count}
            stats={stats}
            busy={busy}
            uploading={uploading}
            uploadResult={uploadResult}
            notifyResult={notifyResult}
            pushResult={pushResult}
            fileRefs={fileRefs}
            onMove={moveCard}
            onUpload={handleUpload}
            onNotifyRyan={handleNotifyRyan}
            onPushShipStation={handlePushShipStation}
          />
        );
      })}
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────────────────────

function Column({ col, cards, count, stats, busy, uploading, uploadResult, notifyResult, pushResult, fileRefs, onMove, onUpload, onNotifyRyan, onPushShipStation }) {
  const isShipped = col.key === "shipped";

  return (
    <div style={{
      flex: isShipped ? "0 0 220px" : "1 1 0",
      minWidth: 220,
      maxWidth: isShipped ? 220 : 320,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        borderTop: `3px solid ${col.color}`,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "8px 8px 0 0",
        padding: "10px 12px 8px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: col.blocking ? 4 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: col.color }}>
            {col.label}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
            background: `${col.color}22`, color: col.color,
          }}>
            {count}
          </span>
        </div>
        {col.blocking && (
          <div style={{ fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>
            {col.blocking}
          </div>
        )}
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
        maxHeight: "calc(100vh - 300px)",
      }}>
        {cards.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "var(--text-dim)" }}>
            {col.emptyText}
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
            notifyState={notifyResult[card.sku]}
            pushState={pushResult[card.sku]}
            fileRef={(el) => { fileRefs.current[card.sku] = el; }}
            onClickFileInput={() => fileRefs.current[card.sku]?.click()}
            onUpload={(file) => onUpload(card, file)}
            onAdvance={() => onMove(card, col.key, NEXT_STATUS[col.key])}
            onNotifyRyan={() => onNotifyRyan(card)}
            onPushShipStation={() => onPushShipStation(card)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  card, column, isBusy,
  isUploading, uploadResult,
  notifyState, pushState,
  fileRef, onClickFileInput, onUpload,
  onAdvance, onNotifyRyan, onPushShipStation,
}) {
  const isShipped = column.key === "shipped";
  const nextStatus = NEXT_STATUS[column.key];
  const actionLabel = ACTION_LABELS[column.key];
  const isDonated = card.orderType === "donated";
  const gmailUrl = card.billingEmail
    ? `https://mail.google.com/mail/#search/${encodeURIComponent(`from:${card.billingEmail} OR to:${card.billingEmail}`)}`
    : null;

  const typeColor = isDonated ? "var(--gold)" : card.orderType === "paid" ? "var(--status-green)" : "var(--status-purple)";
  const typeLabel = isDonated ? "DONATED" : card.orderType ? card.orderType.toUpperCase() : null;

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8,
      padding: 10,
      borderLeft: `3px solid ${isDonated ? "var(--gold)" : card.orderType === "paid" ? "var(--status-green)44" : "var(--card-border)"}`,
    }}>
      {/* Hero name + type badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4, marginBottom: 3 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
          {card.heroName || card.sku}
        </div>
        {typeLabel && (
          <span style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0,
            background: typeColor + "22", color: typeColor,
          }}>
            {typeLabel}
          </span>
        )}
      </div>

      {/* SKU + size */}
      <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-dim)" }}>
          {card.sku}
        </span>
        {card.size && (
          <span style={{
            fontSize: 9, padding: "1px 4px", borderRadius: 3, fontWeight: 700,
            background: card.size === "6" ? "#8e44ad22" : "#3498db22",
            color: card.size === "6" ? "#8e44ad" : "#3498db",
          }}>
            {sizeLabel(card.size)}
          </span>
        )}
        {card.totalQty > 1 && (
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>×{card.totalQty}</span>
        )}
      </div>

      {/* Order # and customer */}
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 2 }}>
        <span style={{ fontFamily: "monospace" }}>#{card.orderNumber}</span>
        {card.orderCount > 1 && (
          <span style={{
            fontSize: 9, padding: "1px 4px", borderRadius: 4, marginLeft: 5,
            background: "var(--status-blue)22", color: "var(--status-blue)", fontWeight: 700,
          }}>
            +{card.orderCount - 1} more
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>
        {card.customers?.[0] || card.customerName}
        {card.customers?.length > 1 && (
          <span style={{ color: "var(--text-dim)" }}> +{card.customers.length - 1}</span>
        )}
      </div>

      {/* Shipping address (ready_to_ship only) */}
      {column.key === "ready_to_ship" && (
        <ShippingBlock card={card} />
      )}

      {/* Shipped date */}
      {isShipped && card.orderDate && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6 }}>
          {new Date(card.orderDate).toLocaleDateString()}
        </div>
      )}

      {/* Gmail link */}
      {gmailUrl && !isShipped && (
        <div style={{ marginBottom: 6 }}>
          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener"
            style={{ fontSize: 10, color: "var(--text-dim)", textDecoration: "none" }}
          >
            📧 Gmail thread
          </a>
        </div>
      )}

      {/* Actions */}
      {!isShipped && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>

          {/* Design Needed: Notify Ryan + Upload */}
          {column.key === "design_needed" && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".svg"
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }}
              />
              <button
                onClick={onNotifyRyan}
                disabled={notifyState === "sending"}
                style={{
                  ...btnBase,
                  background: "var(--status-orange)15",
                  border: "1px solid var(--status-orange)",
                  color: notifyState === "sent" ? "var(--status-green)" : notifyState === "error" ? "var(--status-red)" : "var(--status-orange)",
                }}
              >
                {notifyState === "sending" ? "Sending…" : notifyState === "sent" ? "✓ Ryan pinged" : notifyState === "error" ? "Slack error" : "🔔 Notify Ryan"}
              </button>
              {isUploading ? (
                <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>Uploading…</div>
              ) : uploadResult?.success ? (
                <div style={{ fontSize: 11, color: "var(--status-green)", textAlign: "center" }}>✓ Uploaded → laser queue</div>
              ) : uploadResult?.error ? (
                <div style={{ fontSize: 11, color: "var(--status-red)" }}>{uploadResult.error}</div>
              ) : (
                <button onClick={onClickFileInput} style={{ ...btnBase, background: "var(--bg-3)", border: "1px solid var(--card-border)", color: "var(--text-dim)" }}>
                  ↑ Upload SVG
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
                style={{
                  ...btnBase,
                  background: "var(--status-blue)15",
                  border: "1px solid var(--status-blue)",
                  color: "var(--status-blue)",
                  textAlign: "center",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                ⬇ Download SVG
              </a>
              <button
                onClick={onAdvance}
                disabled={isBusy}
                style={{ ...btnBase, opacity: isBusy ? 0.5 : 1 }}
              >
                {isBusy ? "Moving…" : actionLabel}
              </button>
            </>
          )}

          {/* In Production: single done button */}
          {column.key === "in_production" && actionLabel && (
            <button onClick={onAdvance} disabled={isBusy} style={{ ...btnBase, opacity: isBusy ? 0.5 : 1 }}>
              {isBusy ? "Moving…" : actionLabel}
            </button>
          )}

          {/* Ready to Ship: ShipStation push + mark shipped */}
          {column.key === "ready_to_ship" && (
            <>
              {isDonated && (
                <button
                  onClick={onPushShipStation}
                  disabled={pushState === "pushing" || card.missingAddress}
                  title={card.missingAddress ? "Add shipping address first" : "Push to ShipStation"}
                  style={{
                    ...btnBase,
                    background: "var(--status-green)15",
                    border: "1px solid var(--status-green)",
                    color: pushState === "pushed" ? "var(--status-green)" : pushState && pushState !== "pushing" ? "var(--status-red)" : "var(--status-green)",
                    opacity: card.missingAddress ? 0.4 : pushState === "pushing" ? 0.6 : 1,
                  }}
                >
                  {pushState === "pushing" ? "Pushing…" : pushState === "pushed" ? "✓ In ShipStation" : pushState ? `⚠ ${pushState}` : "🚀 Push to ShipStation"}
                </button>
              )}
              {!isDonated && (
                <div style={{ fontSize: 10, color: "var(--status-green)", textAlign: "center", padding: "3px 0" }}>
                  ✓ Already in ShipStation
                </div>
              )}
              <button
                onClick={onAdvance}
                disabled={isBusy}
                style={{
                  ...btnBase,
                  background: "var(--gold)15",
                  border: "1px solid var(--gold)",
                  color: "var(--gold)",
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                {isBusy ? "Moving…" : actionLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shipping block ────────────────────────────────────────────────────────────

function ShippingBlock({ card }) {
  if (card.missingAddress && card.orderCount > 1) {
    return (
      <div style={{
        fontSize: 10, color: "var(--status-orange)",
        background: "var(--status-orange)12",
        border: "1px solid var(--status-orange)44",
        borderRadius: 4, padding: "4px 7px", marginBottom: 6,
      }}>
        ⚠ Some orders missing address — can't auto-ship
      </div>
    );
  }

  if (!card.shippingAddress1 && !card.shippingCity) {
    return (
      <div style={{
        fontSize: 10, color: "var(--status-red)",
        background: "var(--status-red)12",
        border: "1px solid var(--status-red)44",
        borderRadius: 4, padding: "4px 7px", marginBottom: 6,
      }}>
        ⚠ No shipping address — update order
      </div>
    );
  }

  const lines = [
    card.shippingName !== card.customerName ? card.shippingName : null,
    card.shippingAddress1,
    [card.shippingCity, card.shippingState, card.shippingPostal].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <div style={{
      fontSize: 10, color: "var(--text-dim)",
      background: "var(--bg-3)",
      borderRadius: 4, padding: "4px 7px", marginBottom: 6,
      lineHeight: 1.5,
    }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

// ─── Shared button style ───────────────────────────────────────────────────────

const btnBase = {
  background: "var(--gold)15",
  border: "1px solid var(--gold)",
  color: "var(--gold)",
  cursor: "pointer",
  padding: "5px 0",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  width: "100%",
};

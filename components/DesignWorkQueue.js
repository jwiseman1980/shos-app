"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const sizeLabel = (s) => {
  if (s === "Regular-7in" || s === "7") return '7"';
  if (s === "Small-6in" || s === "6") return '6"';
  return s || "\u2014";
};

export default function DesignWorkQueue({ items: initialItems = [], proactiveItems: initialProactive = [] }) {
  const [items, setItems] = useState(initialItems);
  const [proactiveQueue, setProactiveQueue] = useState(initialProactive);
  const [uploading, setUploading] = useState({});
  const [uploadResult, setUploadResult] = useState({});
  const [advancing, setAdvancing] = useState({});
  const [showQueueForm, setShowQueueForm] = useState(false);
  const fileInputRefs = useRef({});

  // Group "needs design" items by SKU so Ryan sees one task per design, not per order
  const needDesignRaw = items.filter((i) => !i.hasDesign);
  const skuGroups = new Map();
  for (const item of needDesignRaw) {
    const key = item.sku;
    if (!skuGroups.has(key)) {
      skuGroups.set(key, { ...item, orderCount: 1, totalQty: item.quantity || 1, allItemIds: [item.itemId] });
    } else {
      const g = skuGroups.get(key);
      g.orderCount++;
      g.totalQty += item.quantity || 1;
      g.allItemIds.push(item.itemId);
    }
  }
  const needDesign = Array.from(skuGroups.values());
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
        // Auto-advance ALL order items with this SKU to ready_to_laser
        const idsToAdvance = item.allItemIds || [item.itemId];
        for (const id of idsToAdvance) {
          try {
            await fetch("/api/orders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                itemId: id,
                status: "ready_to_laser",
                heroName: item.heroName || item.sku,
              }),
            });
          } catch (advErr) {
            console.warn("Auto-advance failed for", id, advErr.message);
          }
        }

        setUploadResult((prev) => ({
          ...prev,
          [item.itemId]: { success: true, url: data.url, advanced: true },
        }));
        // Remove all items with this SKU from queue
        const advancedIds = new Set(idsToAdvance);
        setItems((prev) => prev.filter((i) => !advancedIds.has(i.itemId)));
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

  const handleProactiveQueued = useCallback((newItem) => {
    setProactiveQueue((prev) => [newItem, ...prev]);
    setShowQueueForm(false);
  }, []);

  const handleRemoveProactive = useCallback(async (heroId) => {
    try {
      const sb = await fetch(`/api/designs/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Reset hero design_status back to not_started
        body: JSON.stringify({ heroId, sizes: [], action: "remove" }),
      });
    } catch {}
    setProactiveQueue((prev) => prev.filter((i) => i.id !== heroId));
  }, []);

  return (
    <div>
      {/* Queue Design button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          onClick={() => setShowQueueForm(true)}
          style={{
            background: "var(--gold)", color: "#000", border: "none", cursor: "pointer",
            padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
          }}
        >
          + Queue Design
        </button>
      </div>

      {showQueueForm && (
        <QueueDesignModal
          onClose={() => setShowQueueForm(false)}
          onQueued={handleProactiveQueued}
        />
      )}

      {/* Proactive design queue — designs queued without orders */}
      {proactiveQueue.length > 0 && (
        <Section title={`Proactive Queue (${proactiveQueue.length})`} color="var(--gold)">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Hero</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Sizes</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {proactiveQueue.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: "var(--text-bright)" }}>{item.name}</span>
                    {item.branch && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.branch}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>
                      {item.lineitem_sku}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                    {item.design_brief?.match(/(\d")/g)?.join(" + ") || "\u2014"}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                      background: item.design_status === "research" ? "#f59e0b22" : item.design_status === "in_progress" ? "var(--status-blue)22" : "var(--status-green)22",
                      color: item.design_status === "research" ? "#f59e0b" : item.design_status === "in_progress" ? "var(--status-blue)" : "var(--status-green)",
                    }}>
                      {item.design_status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-dim)", maxWidth: 200 }}>
                    {item.design_brief?.replace(/Proactive design queue:.*?\.\n?/, "").trim() || "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

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
                    {item.orderCount > 1 && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 4, marginLeft: 6,
                        background: "var(--status-blue)33", color: "var(--status-blue)", fontWeight: 700,
                      }}>
                        +{item.orderCount - 1} more
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {item.totalQty > 1 ? `${item.totalQty} bracelets total` : item.orderDate ? new Date(item.orderDate).toLocaleDateString() : ""}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-dim)" }}>
                    {item.customerName}
                    {item.orderCount > 1 && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)" }}> + {item.orderCount - 1} other{item.orderCount > 2 ? "s" : ""}</span>
                    )}
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

      {items.length === 0 && proactiveQueue.length === 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", color: "var(--status-green)", fontSize: 14 }}>
          {"\u2713"} All orders have designs. Nothing in the queue.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue Design Modal
// ---------------------------------------------------------------------------

function QueueDesignModal({ onClose, onQueued }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sizes, setSizes] = useState({ "6": false, "7": false });
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const searchTimeout = useRef(null);

  // Debounced hero search
  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/heroes?search=${encodeURIComponent(search)}&limit=10`);
        const data = await res.json();
        setResults(data.heroes || data || []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  const handleSubmit = async () => {
    if (!selected) { setError("Select a hero"); return; }
    const selectedSizes = Object.entries(sizes).filter(([, v]) => v).map(([k]) => k);
    if (selectedSizes.length === 0) { setError("Select at least one size"); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/designs/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId: selected.id, sizes: selectedSizes, brief }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      onQueued({
        ...selected,
        design_status: "research",
        design_brief: `Proactive design queue: ${selectedSizes.map(s => s + '"').join(" + ")} sizes needed.${brief ? "\n" + brief : ""}`,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--card-bg)", border: "1px solid var(--card-border)",
        borderRadius: 12, padding: 24, width: 420, maxHeight: "80vh", overflow: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "var(--text-bright)" }}>Queue a Design</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 18 }}>{"\u00d7"}</button>
        </div>

        {/* Hero search */}
        <label style={labelStyle}>Hero</label>
        {selected ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", borderRadius: 6, background: "var(--status-green)11",
            border: "1px solid var(--status-green)44", marginBottom: 12,
          }}>
            <div>
              <span style={{ fontWeight: 600, color: "var(--text-bright)" }}>{selected.name}</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8, fontFamily: "monospace" }}>{selected.lineitem_sku}</span>
            </div>
            <button onClick={() => { setSelected(null); setSearch(""); }} style={{
              background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 14,
            }}>{"\u00d7"}</button>
          </div>
        ) : (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              autoFocus
              style={inputStyle}
            />
            {results.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                background: "var(--card-bg)", border: "1px solid var(--card-border)",
                borderRadius: 6, maxHeight: 200, overflow: "auto", marginTop: 2,
              }}>
                {results.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => { setSelected(h); setResults([]); setSearch(""); }}
                    style={{
                      padding: "8px 12px", cursor: "pointer", fontSize: 13,
                      borderBottom: "1px solid var(--card-border)",
                    }}
                    onMouseEnter={(e) => e.target.style.background = "var(--status-blue)11"}
                    onMouseLeave={(e) => e.target.style.background = "transparent"}
                  >
                    <span style={{ fontWeight: 500, color: "var(--text-bright)" }}>{h.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8, fontFamily: "monospace" }}>{h.lineitem_sku}</span>
                    {h.branch && <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 8 }}>{h.branch}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Size selector */}
        <label style={labelStyle}>Sizes</label>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          {["6", "7"].map((s) => (
            <label key={s} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={sizes[s]}
                onChange={() => setSizes((prev) => ({ ...prev, [s]: !prev[s] }))}
              />
              <span style={{ color: "var(--text-bright)" }}>{s}"</span>
            </label>
          ))}
        </div>

        {/* Brief */}
        <label style={labelStyle}>Notes for designer (optional)</label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Any special instructions..."
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        {error && <div style={{ color: "var(--status-red)", fontSize: 12, marginTop: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: "transparent", border: "1px solid var(--card-border)",
            color: "var(--text-dim)", cursor: "pointer", padding: "8px 16px", borderRadius: 6, fontSize: 12,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{
            background: "var(--gold)", color: "#000", border: "none", cursor: "pointer",
            padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            opacity: submitting ? 0.6 : 1,
          }}>{submitting ? "Queuing..." : "Add to Queue"}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles & helpers
// ---------------------------------------------------------------------------

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
const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" };
const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--card-border)", background: "var(--bg)", color: "var(--text-bright)", fontSize: 13, boxSizing: "border-box" };

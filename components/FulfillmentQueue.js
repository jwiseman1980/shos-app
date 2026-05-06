"use client";

import { useState, useMemo } from "react";

const STATUS_META = {
  awaiting_shipment: { label: "Ready to Ship", color: "#10b981" },
  on_hold:           { label: "On Hold",       color: "#ef4444" },
};

function ageDays(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function ageColor(d) {
  if (d == null) return "var(--text-dim)";
  if (d >= 14) return "var(--status-red)";
  if (d >= 7)  return "var(--status-orange)";
  return "var(--status-green)";
}

export default function FulfillmentQueue({ orders = [] }) {
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("asc"); // oldest first by default
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        // Missing dates sort last in both directions so they don't masquerade as the oldest order.
        case "date":     av = a.orderDate ? new Date(a.orderDate).getTime() : Infinity;
                         bv = b.orderDate ? new Date(b.orderDate).getTime() : Infinity; break;
        case "order":    av = a.orderNumber || ""; bv = b.orderNumber || ""; break;
        case "customer": av = (a.customer || "").toLowerCase(); bv = (b.customer || "").toLowerCase(); break;
        case "status":   av = a.status || ""; bv = b.status || ""; break;
        case "qty":      av = a.totalQty || 0; bv = b.totalQty || 0; break;
        default:         av = 0; bv = 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function setSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const awaitingCount = orders.filter((o) => o.status === "awaiting_shipment").length;
  const onHoldCount   = orders.filter((o) => o.status === "on_hold").length;

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", marginBottom: 12,
        padding: "8px 12px", background: "var(--card-bg)",
        border: "1px solid var(--card-border)", borderRadius: 8,
      }}>
        <label style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Status:&nbsp;
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All ({orders.length})</option>
            <option value="awaiting_shipment">Ready to Ship ({awaitingCount})</option>
            {onHoldCount > 0 && (
              <option value="on_hold">On Hold ({onHoldCount})</option>
            )}
          </select>
        </label>
        <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>
          Showing {sorted.length} of {orders.length}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          padding: "32px 0", textAlign: "center",
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)", borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No matching orders.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "var(--card-bg)",
                       border: "1px solid var(--card-border)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                <SortHeader label="Order" k="order" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                <SortHeader label="Customer" k="customer" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                <th style={thStyle}>Items</th>
                <SortHeader label="Qty" k="qty" sortKey={sortKey} sortDir={sortDir} onSort={setSort} align="right" />
                <SortHeader label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                <SortHeader label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => {
                const days = ageDays(o.orderDate);
                const statusMeta = STATUS_META[o.status] || { label: o.status, color: "#64748b" };
                return (
                  <tr key={o.key} style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "var(--text-bright)" }}>
                      #{o.orderNumber || "—"}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 12, color: "var(--text-bright)" }}>{o.customer || "—"}</div>
                      {o.email && (
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{o.email}</div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {o.items.slice(0, 3).map((it, i) => (
                        <div key={i} style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4 }}>
                          {it.name || it.sku} × {it.qty}
                        </div>
                      ))}
                      {o.items.length > 3 && (
                        <div style={{ fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>
                          + {o.items.length - 3} more line{o.items.length - 3 > 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {o.totalQty}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontSize: 12, color: "var(--text-bright)" }}>
                        {o.orderDate ? new Date(o.orderDate).toLocaleDateString() : "—"}
                      </div>
                      {days != null && (
                        <div style={{ fontSize: 10, color: ageColor(days), fontWeight: 600 }}>
                          {days}d old
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        padding: "2px 7px", borderRadius: 10,
                        background: statusMeta.color + "22",
                        color: statusMeta.color,
                        border: `1px solid ${statusMeta.color}55`,
                        whiteSpace: "nowrap",
                      }}>
                        {statusMeta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortHeader({ label, k, sortKey, sortDir, onSort, align }) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onSort(k)}
      style={{
        ...thStyle,
        cursor: "pointer",
        userSelect: "none",
        textAlign: align || "left",
        color: active ? "var(--text-bright)" : "var(--text-dim)",
      }}
      title={`Sort by ${label}`}
    >
      {label}
      {active && (
        <span style={{ marginLeft: 4, fontSize: 9 }}>
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </th>
  );
}

const tdStyle = { padding: "8px 12px", fontSize: 13, verticalAlign: "top" };
const thStyle = {
  padding: "8px 12px", fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", textAlign: "left",
};
const selectStyle = {
  background: "var(--bg)", color: "var(--text-bright)",
  border: "1px solid var(--card-border)", borderRadius: 4,
  padding: "3px 6px", fontSize: 11,
};

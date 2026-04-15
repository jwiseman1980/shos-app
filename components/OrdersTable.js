"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Status / type metadata ───────────────────────────────────────────────────

export const STATUS_META = {
  not_started:    { label: "Not Started",    color: "#f59e0b" },
  design_needed:  { label: "Design Needed",  color: "#f59e0b" },
  ready_to_laser: { label: "Ready to Laser", color: "#3b82f6" },
  in_production:  { label: "In Production",  color: "#06b6d4" },
  ready_to_ship:  { label: "Ready to Ship",  color: "#22c55e" },
  shipped:        { label: "Shipped",        color: "#6b7280" },
  delivered:      { label: "Delivered",      color: "#22c55e" },
  cancelled:      { label: "Cancelled",      color: "#ef4444" },
};

const STATUS_OPTIONS = [
  "design_needed", "ready_to_laser", "in_production",
  "ready_to_ship", "shipped", "delivered", "cancelled",
];

export const TYPE_META = {
  paid:        { label: "Paid",        color: "#22c55e" },
  donated:     { label: "Donated",     color: "#c4a237" },
  wholesale:   { label: "Wholesale",   color: "#8b5cf6" },
  gift:        { label: "Gift",        color: "#ec4899" },
  replacement: { label: "Replacement", color: "#64748b" },
};

function StatusBadge({ status, small }) {
  const meta = STATUS_META[status] || { label: status || "—", color: "#6b7280" };
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "1px 6px" : "2px 8px",
      borderRadius: 12,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      background: meta.color + "22",
      color: meta.color,
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

function TypeBadge({ type, small }) {
  const meta = TYPE_META[type] || { label: type || "—", color: "#6b7280" };
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "1px 6px" : "2px 8px",
      borderRadius: 12,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      background: meta.color + "22",
      color: meta.color,
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

// ── Inline item status updater ───────────────────────────────────────────────

function ItemStatusSelect({ itemId, heroName, currentStatus, onUpdated }) {
  const [value,    setValue]    = useState(currentStatus);
  const [updating, setUpdating] = useState(false);

  async function handleChange(e) {
    const newStatus = e.target.value;
    setValue(newStatus);
    setUpdating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, status: newStatus, heroName }),
      });
      const data = await res.json();
      if (data.success && onUpdated) onUpdated(itemId, newStatus);
    } catch (err) {
      console.error("Status update failed:", err);
      setValue(currentStatus); // rollback
    } finally {
      setUpdating(false);
    }
  }

  const meta = STATUS_META[value] || { color: "#6b7280" };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={updating}
      style={{
        background: "var(--bg)",
        color: meta.color,
        border: `1px solid ${meta.color}44`,
        borderRadius: 6,
        padding: "3px 6px",
        fontSize: 11,
        fontWeight: 600,
        cursor: updating ? "wait" : "pointer",
        opacity: updating ? 0.6 : 1,
      }}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
      ))}
    </select>
  );
}

// ── Order row with expandable line items ─────────────────────────────────────

function OrderRow({ order, defaultExpanded = false }) {
  const [expanded, setExpanded]         = useState(defaultExpanded);
  const [items,    setItems]            = useState(order.items || []);
  const [worstStatus, setWorstStatus]   = useState(order.worstStatus || "");

  // STATUS_RANK for re-computing order badge after inline updates
  const STATUS_RANK = {
    not_started: 0, design_needed: 1, ready_to_laser: 2,
    in_production: 3, ready_to_ship: 4, shipped: 5,
    delivered: 6, cancelled: 7,
  };

  function handleItemUpdated(itemId, newStatus) {
    const updated = items.map((i) => i.id === itemId ? { ...i, productionStatus: newStatus } : i);
    setItems(updated);
    const worst = updated.reduce((w, i) => {
      const r = STATUS_RANK[i.productionStatus] ?? 99;
      return r < (STATUS_RANK[w] ?? 99) ? i.productionStatus : w;
    }, updated[0]?.productionStatus || "");
    setWorstStatus(worst);
  }

  const isDonated     = order.orderType === "donated";
  const multiItem     = items.length > 1;
  const accentColor   = isDonated ? "var(--gold)" : "var(--card-border)";

  return (
    <>
      {/* Order header row */}
      <tr
        onClick={() => setExpanded((e) => !e)}
        style={{
          borderBottom: expanded ? "none" : "1px solid var(--card-border)",
          cursor: "pointer",
          background: expanded ? "var(--bg-2)" : "transparent",
        }}
      >
        {/* Expand toggle + order number */}
        <td style={{ ...tdStyle, paddingLeft: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 10, color: "var(--text-dim)",
              transition: "transform 0.15s",
              display: "inline-block",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}>▶</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>
                  {order.orderNumber || "—"}
                </span>
                {isDonated && (
                  <span style={{ fontSize: 9, padding: "0 5px", borderRadius: 8, background: "var(--gold)", color: "#000", fontWeight: 700 }}>
                    DONATED
                  </span>
                )}
                {multiItem && (
                  <span style={{ fontSize: 9, padding: "0 5px", borderRadius: 8, background: "var(--card-border)", color: "var(--text-dim)", fontWeight: 600 }}>
                    {items.length} items
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {order.orderDate
                  ? new Date(order.orderDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—"}
              </div>
            </div>
          </div>
        </td>

        {/* Customer */}
        <td style={tdStyle}>
          <div style={{ fontSize: 13, color: "var(--text-bright)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {order.customerName || "—"}
          </div>
          {order.shipTo && (
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{order.shipTo}</div>
          )}
        </td>

        {/* Summary: bracelets */}
        <td style={{ ...tdStyle, textAlign: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-bright)" }}>
            {order.totalQty}
          </span>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
            bracelet{order.totalQty !== 1 ? "s" : ""}
          </div>
        </td>

        {/* Revenue */}
        <td style={{ ...tdStyle, textAlign: "right" }}>
          {order.totalRevenue > 0 ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>
              ${order.totalRevenue.toFixed(2)}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
          )}
        </td>

        {/* Type */}
        <td style={tdStyle}>
          <TypeBadge type={order.orderType} small />
        </td>

        {/* Status (worst item status) */}
        <td style={tdStyle}>
          <StatusBadge status={worstStatus} small />
          {multiItem && (
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
              {items.filter((i) => i.productionStatus === "shipped").length}/{items.length} shipped
            </div>
          )}
        </td>
      </tr>

      {/* Expanded: line items */}
      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
          <td colSpan={6} style={{ padding: 0 }}>
            <div style={{
              background: "var(--bg-3)",
              borderLeft: `3px solid ${accentColor}`,
              margin: "0 0 0 28px",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <ItemTh>Hero</ItemTh>
                    <ItemTh>SKU</ItemTh>
                    <ItemTh center>Qty</ItemTh>
                    <ItemTh center>Size</ItemTh>
                    <ItemTh right>Unit Price</ItemTh>
                    <ItemTh>Status</ItemTh>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: idx < items.length - 1 ? "1px solid var(--card-border)" : "none",
                        background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                      }}
                    >
                      <td style={{ ...itemTdStyle, fontWeight: 500, color: "var(--text-bright)" }}>
                        {item.heroName || "—"}
                      </td>
                      <td style={itemTdStyle}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                          {item.sku || "—"}
                        </span>
                      </td>
                      <td style={{ ...itemTdStyle, textAlign: "center", fontWeight: 700, color: "var(--text-bright)" }}>
                        {item.quantity}
                      </td>
                      <td style={{ ...itemTdStyle, textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
                        {item.size ? `${item.size}"` : "—"}
                      </td>
                      <td style={{ ...itemTdStyle, textAlign: "right" }}>
                        {item.unitPrice > 0 ? (
                          <span style={{ fontSize: 12, color: "var(--text-bright)" }}>
                            ${item.unitPrice.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
                        )}
                      </td>
                      <td style={itemTdStyle}>
                        <ItemStatusSelect
                          itemId={item.id}
                          heroName={item.heroName}
                          currentStatus={item.productionStatus}
                          onUpdated={handleItemUpdated}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ItemTh({ children, center, right }) {
  return (
    <th style={{
      padding: "6px 12px",
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--text-dim)",
      textAlign: center ? "center" : right ? "right" : "left",
    }}>
      {children}
    </th>
  );
}

// ── Sort header ──────────────────────────────────────────────────────────────

function Th({ label, sortKey, activeSortKey, dir, onClick }) {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      style={{
        padding: "9px 12px",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: isActive ? "var(--text-bright)" : "var(--text-dim)",
        textAlign: "left",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: isActive ? 1 : 0.25 }}>
        {isActive ? (dir === "asc" ? "↑" : "↓") : "⇅"}
      </span>
    </th>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────

function PagBtn({ label, disabled, active, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: active ? "var(--gold)" : "none",
        color: active ? "#000" : disabled ? "var(--text-dim)" : "var(--text)",
        border: `1px solid ${active ? "var(--gold)" : "var(--card-border)"}`,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontWeight: active ? 700 : 400,
        minWidth: 36,
      }}
    >
      {label}
    </button>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────────

const inputStyle = {
  background: "var(--bg-2)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  color: "var(--text-bright)",
  padding: "5px 10px",
  fontSize: 12,
  outline: "none",
};

const tdStyle = {
  padding: "10px 12px",
  fontSize: 13,
  verticalAlign: "middle",
};

const itemTdStyle = {
  padding: "7px 12px",
  fontSize: 12,
  verticalAlign: "middle",
};

// ── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

/**
 * Orders history table — API-backed.
 * Shows one row per ORDER. Click to expand and see individual line items.
 * Each line item has its own production status with inline update.
 */
export default function OrdersTable({ initialType = "", initialStatus = "" }) {
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState(initialStatus);
  const [type,     setType]     = useState(initialType);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [sortBy,   setSortBy]   = useState("date");
  const [sortDir,  setSortDir]  = useState("desc");
  const [page,     setPage]     = useState(1);

  const [orders,     setOrders]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Debounce search
  const debounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sortBy, sortDir });
      if (debouncedSearch) params.set("search",   debouncedSearch);
      if (status)          params.set("status",   status);
      if (type)            params.set("type",     type);
      if (dateFrom)        params.set("dateFrom", dateFrom);
      if (dateTo)          params.set("dateTo",   dateTo);

      const res = await fetch(`/api/orders/history?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setOrders(data.orders || []);
      setTotal(data.total   || 0);
      setTotalPages(data.pages || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, type, dateFrom, dateTo, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleSort(key) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setStatus(initialStatus);
    setType(initialType);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const hasFilters = search ||
    (status && status !== initialStatus) ||
    (type   && type   !== initialType)   ||
    dateFrom || dateTo;

  const safePages = Math.max(1, totalPages);
  const safePage  = Math.min(page, safePages);

  function paginationPages() {
    if (safePages <= 7) return Array.from({ length: safePages }, (_, i) => i + 1);
    if (safePage <= 4)              return [1, 2, 3, 4, 5, 6, 7];
    if (safePage >= safePages - 3)  return Array.from({ length: 7 }, (_, i) => safePages - 6 + i);
    return Array.from({ length: 7 }, (_, i) => safePage - 3 + i);
  }

  // Aggregate totals across current page for the summary line
  const pageTotalBracelets = orders.reduce((s, o) => s + o.totalQty, 0);
  const pageRevenue        = orders.reduce((s, o) => s + o.totalRevenue, 0);

  return (
    <div>
      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search order #, hero, customer, SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 220 }}
        />

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active (not shipped)</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <input type="date" value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 138 }} title="Order date from" />
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>–</span>
        <input type="date" value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 138 }} title="Order date to" />

        {hasFilters && (
          <button onClick={resetFilters} style={{
            background: "none", border: "1px solid var(--card-border)",
            color: "var(--text-dim)", borderRadius: 6, padding: "5px 10px",
            fontSize: 11, cursor: "pointer",
          }}>
            Clear
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          {loading ? "Loading…" : (
            <>
              {total.toLocaleString()} orders
              {pageTotalBracelets > 0 && ` · ${pageTotalBracelets} bracelets`}
              {pageRevenue > 0 && ` · $${pageRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              {" (this page)"}
            </>
          )}
        </span>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--card-border)", position: "relative" }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(14,14,18,0.65)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 2, borderRadius: 8,
          }}>
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading…</span>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--card-border)" }}>
              <Th label="Order / Date" sortKey="date"        activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="Customer"     sortKey="customer"    activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <th style={thStyle}>Bracelets</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
              <Th label="Type"         sortKey="type"        activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="Status"       sortKey="status"      activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--status-red)", fontSize: 13 }}>
                  Error: {error}
                </td>
              </tr>
            ) : !loading && orders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                  No orders match the current filters.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {safePages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          <PagBtn label="← Prev" disabled={safePage <= 1}        onClick={() => setPage((p) => p - 1)} />
          {paginationPages().map((n) => (
            <PagBtn key={n} label={n} active={n === safePage} onClick={() => setPage(n)} />
          ))}
          <PagBtn label="Next →" disabled={safePage >= safePages} onClick={() => setPage((p) => p + 1)} />
          <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>
            {safePage} / {safePages} · {total.toLocaleString()} orders total
          </span>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "9px 12px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-dim)",
  textAlign: "left",
};

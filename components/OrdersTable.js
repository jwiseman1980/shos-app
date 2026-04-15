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

export const TYPE_META = {
  paid:        { label: "Paid",        color: "#22c55e" },
  donated:     { label: "Donated",     color: "#c4a237" },
  wholesale:   { label: "Wholesale",   color: "#8b5cf6" },
  gift:        { label: "Gift",        color: "#ec4899" },
  replacement: { label: "Replacement", color: "#64748b" },
};

function Badge({ meta, small }) {
  if (!meta) return null;
  const c = meta.color;
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "1px 6px" : "2px 8px",
      borderRadius: 12,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      background: c + "22",
      color: c,
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

// ── Sort column header ───────────────────────────────────────────────────────

function Th({ label, sortKey, activeSortKey, dir, onClick, style = {} }) {
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
        ...style,
      }}
    >
      {label}
      <span style={{ marginLeft: 4, opacity: isActive ? 1 : 0.25 }}>
        {isActive ? (dir === "asc" ? "↑" : "↓") : "⇅"}
      </span>
    </th>
  );
}

// ── Pagination button ────────────────────────────────────────────────────────

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

// ── Shared input styles ──────────────────────────────────────────────────────

const inputStyle = {
  background: "var(--bg-2)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  color: "var(--text-bright)",
  padding: "5px 10px",
  fontSize: 12,
  outline: "none",
};

// ── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

/**
 * API-backed orders table. Fetches from /api/orders/history with server-side
 * filtering, sorting, and pagination. Handles 17k+ rows gracefully.
 *
 * Props:
 *   initialType   string  — pre-set the type filter (e.g. "donated")
 *   initialStatus string  — pre-set the status filter
 */
export default function OrdersTable({ initialType = "", initialStatus = "" }) {
  const [search,     setSearch]     = useState("");
  const [status,     setStatus]     = useState(initialStatus);
  const [type,       setType]       = useState(initialType);
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [sortBy,     setSortBy]     = useState("date");
  const [sortDir,    setSortDir]    = useState("desc");
  const [page,       setPage]       = useState(1);

  const [items,      setItems]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // Debounce search: don't fire until the user pauses typing
  const searchDebounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  // Fetch whenever any query param changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:    String(page),
        limit:   String(PAGE_SIZE),
        sortBy,
        sortDir,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status)   params.set("status",   status);
      if (type)     params.set("type",     type);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);

      const res = await fetch(`/api/orders/history?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.pages || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, type, dateFrom, dateTo, sortBy, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const hasFilters = search || (status && status !== initialStatus) ||
    (type && type !== initialType) || dateFrom || dateTo;

  const safePages = Math.max(1, totalPages);
  const safePage  = Math.min(page, safePages);

  // Build pagination window (up to 7 buttons)
  function paginationPages() {
    if (safePages <= 7) return Array.from({ length: safePages }, (_, i) => i + 1);
    if (safePage <= 4)          return [1, 2, 3, 4, 5, 6, 7];
    if (safePage >= safePages - 3) return Array.from({ length: 7 }, (_, i) => safePages - 6 + i);
    return Array.from({ length: 7 }, (_, i) => safePage - 3 + i);
  }

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
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

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 138 }}
          title="Order date from"
        />
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 138 }}
          title="Order date to"
        />

        {hasFilters && (
          <button
            onClick={resetFilters}
            style={{
              background: "none",
              border: "1px solid var(--card-border)",
              color: "var(--text-dim)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          {loading ? "Loading…" : `${total.toLocaleString()} items`}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--card-border)", position: "relative" }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(14,14,18,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2, borderRadius: 8,
          }}>
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Loading…</span>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead>
            <tr style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--card-border)" }}>
              <Th label="Date"     sortKey="date"   activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="Order #"  sortKey="orderNumber" activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="Customer" sortKey="customer"    activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="Hero"     sortKey="hero"        activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="SKU"      sortKey="sku"         activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="Qty"      sortKey="qty"         activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} style={{ textAlign: "center" }} />
              <Th label="Price"    sortKey="price"       activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} style={{ textAlign: "right" }} />
              <Th label="Type"     sortKey="type"        activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
              <Th label="Status"   sortKey="status"      activeSortKey={sortBy} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--status-red)", fontSize: 13 }}>
                  Error loading orders: {error}
                </td>
              </tr>
            ) : !loading && items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                  No orders match the current filters.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid var(--card-border)",
                    background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                  }}
                >
                  {/* Date */}
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                      {item.orderDate
                        ? new Date(item.orderDate + "T12:00:00").toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </span>
                  </td>

                  {/* Order # */}
                  <td style={tdStyle}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-bright)" }}>
                      {item.orderNumber || "—"}
                    </span>
                  </td>

                  {/* Customer */}
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: "var(--text-bright)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.customerName || "—"}
                    </div>
                    {item.shipTo && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.shipTo}</div>
                    )}
                  </td>

                  {/* Hero */}
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                      {item.heroName || "—"}
                    </span>
                  </td>

                  {/* SKU */}
                  <td style={tdStyle}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                      {item.sku || "—"}
                    </span>
                  </td>

                  {/* Qty + size */}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-bright)", fontSize: 14 }}>
                      {item.quantity}
                    </span>
                    {item.size && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)", display: "block" }}>
                        {item.size}"
                      </span>
                    )}
                  </td>

                  {/* Price */}
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {item.unitPrice > 0 ? (
                      <span style={{ fontSize: 13, color: "var(--text-bright)" }}>
                        ${item.unitPrice.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
                    )}
                  </td>

                  {/* Type */}
                  <td style={tdStyle}>
                    <Badge meta={TYPE_META[item.orderType]} small />
                  </td>

                  {/* Status */}
                  <td style={tdStyle}>
                    <Badge
                      meta={STATUS_META[item.productionStatus] || {
                        label: item.productionStatus || "—",
                        color: "#6b7280",
                      }}
                      small
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {safePages > 1 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          gap: 6, marginTop: 14, flexWrap: "wrap",
        }}>
          <PagBtn label="← Prev" disabled={safePage <= 1}       onClick={() => setPage((p) => p - 1)} />
          {paginationPages().map((n) => (
            <PagBtn key={n} label={n} active={n === safePage} onClick={() => setPage(n)} />
          ))}
          <PagBtn label="Next →" disabled={safePage >= safePages} onClick={() => setPage((p) => p + 1)} />
          <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>
            {safePage} / {safePages} · {total.toLocaleString()} total
          </span>
        </div>
      )}
    </div>
  );
}

const tdStyle = {
  padding: "9px 12px",
  fontSize: 13,
  verticalAlign: "middle",
};

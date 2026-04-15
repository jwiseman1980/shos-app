"use client";

import { useState, useMemo } from "react";

const STATUS_META = {
  not_started:   { label: "Not Started",    bg: "#f59e0b22", text: "#f59e0b" },
  design_needed: { label: "Design Needed",  bg: "#f59e0b22", text: "#f59e0b" },
  ready_to_laser:{ label: "Ready to Laser", bg: "#3b82f622", text: "#3b82f6" },
  in_production: { label: "In Production",  bg: "#06b6d422", text: "#06b6d4" },
  ready_to_ship: { label: "Ready to Ship",  bg: "#22c55e22", text: "#22c55e" },
  shipped:       { label: "Shipped",        bg: "#6b728022", text: "#6b7280" },
  delivered:     { label: "Delivered",      bg: "#22c55e44", text: "#22c55e" },
  cancelled:     { label: "Cancelled",      bg: "#ef444422", text: "#ef4444" },
};

const TYPE_META = {
  paid:        { label: "Paid",        bg: "#22c55e22", text: "#22c55e" },
  donated:     { label: "Donated",     bg: "#c4a23722", text: "#c4a237" },
  wholesale:   { label: "Wholesale",   bg: "#8b5cf622", text: "#8b5cf6" },
  gift:        { label: "Gift",        bg: "#ec489922", text: "#ec4899" },
  replacement: { label: "Replacement", bg: "#64748b22", text: "#64748b" },
};

function Badge({ meta }) {
  if (!meta) return null;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: meta.bg,
      color: meta.text,
      whiteSpace: "nowrap",
    }}>
      {meta.label}
    </span>
  );
}

const PAGE_SIZE = 50;

const SORT_FIELDS = [
  { key: "orderDate", label: "Date" },
  { key: "orderNumber", label: "Order #" },
  { key: "customerName", label: "Customer" },
  { key: "heroName", label: "Hero" },
  { key: "quantity", label: "Qty" },
  { key: "unitPrice", label: "Price" },
  { key: "productionStatus", label: "Status" },
];

export default function OrdersTable({ items = [] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState("orderDate");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.productionStatus !== statusFilter) return false;
      if (typeFilter !== "all" && item.orderType !== typeFilter) return false;
      if (dateFrom && item.orderDate && item.orderDate < dateFrom) return false;
      if (dateTo && item.orderDate && item.orderDate > dateTo) return false;
      if (q) {
        const haystack = [
          item.orderNumber,
          item.heroName,
          item.customerName,
          item.sku,
          item.shipTo,
          item.customerEmail,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, typeFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  function handleFilterChange(fn) {
    fn();
    setPage(1);
  }

  const totalQty = filtered.reduce((s, i) => s + (i.quantity || 1), 0);
  const totalRev = filtered
    .filter((i) => i.orderType === "paid")
    .reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);

  const sortIcon = (key) => {
    if (sortKey !== key) return <span style={{ color: "#444", marginLeft: 3 }}>⇅</span>;
    return <span style={{ marginLeft: 3 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center",
      }}>
        <input
          type="text"
          placeholder="Search order #, hero, customer, SKU…"
          value={search}
          onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
          style={inputStyle}
        />
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(() => setStatusFilter(e.target.value))}
          style={selectStyle}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => handleFilterChange(() => setTypeFilter(e.target.value))}
          style={selectStyle}
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => handleFilterChange(() => setDateFrom(e.target.value))}
          style={{ ...selectStyle, width: 140 }}
          title="From date"
        />
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => handleFilterChange(() => setDateTo(e.target.value))}
          style={{ ...selectStyle, width: 140 }}
          title="To date"
        />
        {(search || statusFilter !== "all" || typeFilter !== "all" || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch(""); setStatusFilter("all"); setTypeFilter("all");
              setDateFrom(""); setDateTo(""); setPage(1);
            }}
            style={{
              background: "none", border: "1px solid var(--card-border)",
              color: "var(--text-dim)", borderRadius: 6, padding: "5px 10px",
              fontSize: 11, cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          {filtered.length} items · {totalQty} bracelets
          {totalRev > 0 && ` · $${totalRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--card-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--card-border)", background: "var(--bg-2)" }}>
              <Th label="Date" sortKey="orderDate" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Order #" sortKey="orderNumber" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Customer" sortKey="customerName" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Hero" sortKey="heroName" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="SKU" sortKey="sku" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Qty" sortKey="quantity" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Price" sortKey="unitPrice" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Type" sortKey="orderType" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <Th label="Status" sortKey="productionStatus" active={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "var(--text-dim)" }}>
                  No orders match the current filters.
                </td>
              </tr>
            ) : (
              pageItems.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid var(--card-border)",
                    background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                  }}
                >
                  <td style={tdStyle}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {item.orderDate ? new Date(item.orderDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-bright)" }}>
                      {item.orderNumber || "—"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: "var(--text-bright)" }}>{item.customerName || "—"}</div>
                    {item.shipTo && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.shipTo}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, color: "var(--text-bright)", fontWeight: 500 }}>
                      {item.heroName || "—"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                      {item.sku || "—"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-bright)" }}>{item.quantity}</span>
                    {item.size && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)", display: "block" }}>{item.size}"</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {item.unitPrice > 0 ? (
                      <span style={{ fontSize: 13, color: "var(--text-bright)" }}>
                        ${item.unitPrice.toFixed(2)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <Badge meta={TYPE_META[item.orderType]} />
                  </td>
                  <td style={tdStyle}>
                    <Badge meta={STATUS_META[item.productionStatus] || { label: item.productionStatus || "—", bg: "#6b728022", text: "#6b7280" }} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          gap: 8, marginTop: 16, flexWrap: "wrap",
        }}>
          <PagBtn label="← Prev" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)} />
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            // Show pages around current
            let pageNum;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (safePage <= 4) {
              pageNum = i + 1;
            } else if (safePage >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = safePage - 3 + i;
            }
            return (
              <PagBtn
                key={pageNum}
                label={pageNum}
                active={pageNum === safePage}
                onClick={() => setPage(pageNum)}
              />
            );
          })}
          <PagBtn label="Next →" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)} />
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Page {safePage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}

function Th({ label, sortKey, active, dir, onClick }) {
  const isActive = active === sortKey;
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
      <span style={{ marginLeft: 4, opacity: isActive ? 1 : 0.3 }}>
        {isActive ? (dir === "asc" ? "↑" : "↓") : "⇅"}
      </span>
    </th>
  );
}

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

const inputStyle = {
  background: "var(--bg-2)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  color: "var(--text-bright)",
  padding: "5px 10px",
  fontSize: 12,
  minWidth: 220,
  outline: "none",
};

const selectStyle = {
  background: "var(--bg-2)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  color: "var(--text)",
  padding: "5px 8px",
  fontSize: 12,
  cursor: "pointer",
  outline: "none",
};

const tdStyle = {
  padding: "9px 12px",
  fontSize: 13,
  verticalAlign: "middle",
};

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_LABELS = {
  not_started: "Not Started",
  design_needed: "Design Needed",
  ready_to_laser: "Ready to Laser",
  in_production: "In Production",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
};

const STATUS_COLORS = {
  not_started: "#95a5a6",
  design_needed: "#e67e22",
  ready_to_laser: "#3498db",
  in_production: "#9b59b6",
  ready_to_ship: "#2ecc71",
  shipped: "#27ae60",
};

const STATUS_ORDER = [
  "not_started",
  "design_needed",
  "ready_to_laser",
  "in_production",
  "ready_to_ship",
  "shipped",
];

export default function OperationsDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/operations/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
        else setError(d.error || "Failed to load dashboard data");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Operations & Sales Dashboard</h1>
          <p className="page-subtitle">Loading operational data...</p>
        </div>
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          Fetching pipeline, orders, inventory, and anniversary data from Supabase...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Operations & Sales Dashboard</h1>
          <p className="page-subtitle">Error loading data</p>
        </div>
        <div className="card" style={{ padding: 20, color: "var(--status-red)", fontSize: 13 }}>
          {error}
        </div>
      </main>
    );
  }

  const {
    pipeline,
    ordersByType,
    recentOrders,
    shipping,
    heroLeaderboard,
    inventory,
    inventoryTotal,
    anniversary,
  } = data;

  const activeItems =
    (pipeline.not_started || 0) +
    (pipeline.design_needed || 0) +
    (pipeline.ready_to_laser || 0) +
    (pipeline.in_production || 0) +
    (pipeline.ready_to_ship || 0);

  const maxPipelineCount = Math.max(1, ...STATUS_ORDER.map((s) => pipeline[s] || 0));

  return (
    <main className="page-shell">
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title">Operations & Sales Dashboard</h1>
          <p className="page-subtitle">
            Real-time pipeline, sales, inventory, and anniversary metrics
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/orders"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              background: "rgba(52, 152, 219, 0.15)",
              color: "#3498db",
              border: "1px solid rgba(52, 152, 219, 0.3)",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Order Board
          </Link>
          <Link
            href="/anniversaries"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              background: "rgba(142, 68, 173, 0.15)",
              color: "#8e44ad",
              border: "1px solid rgba(142, 68, 173, 0.3)",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Anniversaries
          </Link>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="Active Pipeline"
          value={activeItems}
          note={`${pipeline.shipped || 0} shipped total`}
          accent="#3498db"
        />
        <StatCard
          label="Paid Orders"
          value={ordersByType.paidOrders}
          note={`${ordersByType.paidBracelets} bracelets`}
          accent="#2ecc71"
        />
        <StatCard
          label="Donated Orders"
          value={ordersByType.donatedOrders}
          note={`${ordersByType.donatedBracelets} bracelets`}
          accent="#e67e22"
        />
        <StatCard
          label="Avg Turnaround"
          value={shipping.avgTurnaroundDays != null ? `${shipping.avgTurnaroundDays}d` : "--"}
          note="Order to shipped"
          accent="#9b59b6"
        />
      </div>

      {/* Pipeline Funnel + Anniversary Side-by-Side */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Pipeline Funnel */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Production Pipeline</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {activeItems} active items
            </span>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {STATUS_ORDER.map((status) => {
              const count = pipeline[status] || 0;
              const pct = (count / maxPipelineCount) * 100;
              return (
                <div
                  key={status}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 120,
                      fontSize: 11,
                      fontWeight: 600,
                      color: STATUS_COLORS[status],
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_LABELS[status]}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: 22,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                        height: "100%",
                        background: STATUS_COLORS[status],
                        opacity: 0.7,
                        borderRadius: "var(--radius-sm)",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 36,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text-bright)",
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Anniversary + Inventory Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Anniversary Cycle */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Anniversary Cycle</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {MONTH_NAMES[anniversary.month] || ""}
              </span>
            </div>
            <div style={{ padding: "16px" }}>
              {/* Completion ring */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 20,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: 80,
                    height: 80,
                  }}
                >
                  <svg viewBox="0 0 36 36" style={{ width: 80, height: 80, transform: "rotate(-90deg)" }}>
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke={anniversary.completionPct >= 80 ? "#2ecc71" : anniversary.completionPct >= 50 ? "#e67e22" : "#e74c3c"}
                      strokeWidth="3"
                      strokeDasharray={`${anniversary.completionPct} ${100 - anniversary.completionPct}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--text-bright)",
                    }}
                  >
                    {anniversary.completionPct}%
                  </div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>
                    <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>{anniversary.total}</span> heroes this month
                  </div>
                  <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>
                    <span style={{ color: "var(--status-green)", fontWeight: 600 }}>{anniversary.complete}</span> complete
                  </div>
                  <div style={{ color: "var(--text-dim)" }}>
                    <span style={{ color: anniversary.overdue > 0 ? "var(--status-red)" : "var(--text-dim)", fontWeight: 600 }}>
                      {anniversary.overdue}
                    </span>{" "}
                    not started
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Summary */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">Inventory On Hand</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {inventoryTotal} total
              </span>
            </div>
            <div style={{ padding: "8px 0", maxHeight: 180, overflowY: "auto" }}>
              {inventory.length === 0 ? (
                <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12 }}>
                  No on-hand inventory.
                </div>
              ) : (
                inventory.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "5px 14px",
                      fontSize: 12,
                      borderBottom: "1px solid var(--card-border)",
                    }}
                  >
                    <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>
                      {item.name}
                    </span>
                    <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
                      {item.onHand7 > 0 && `7": ${item.onHand7}`}
                      {item.onHand7 > 0 && item.onHand6 > 0 && " / "}
                      {item.onHand6 > 0 && `6": ${item.onHand6}`}
                      {item.onHand7 === 0 && item.onHand6 === 0 && item.total}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Paid vs Donated Split */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ borderTop: "3px solid #2ecc71" }}>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 6 }}>
              Paid Orders
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text-bright)" }}>
                {ordersByType.paidOrders}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>orders</span>
            </div>
            <div style={{ fontSize: 13, color: "#2ecc71", fontWeight: 600, marginTop: 4 }}>
              {ordersByType.paidBracelets} bracelets sold
            </div>
          </div>
        </div>
        <div className="card" style={{ borderTop: "3px solid #e67e22" }}>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", marginBottom: 6 }}>
              Donated Orders
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text-bright)" }}>
                {ordersByType.donatedOrders}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>orders</span>
            </div>
            <div style={{ fontSize: 13, color: "#e67e22", fontWeight: 600, marginTop: 4 }}>
              {ordersByType.donatedBracelets} bracelets donated
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column: Recent Orders + Hero Leaderboard */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Recent Orders */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <span className="card-title">Recent Orders</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              Last 30 days
            </span>
          </div>
          <div style={{ maxHeight: 440, overflowY: "auto" }}>
            {recentOrders.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12 }}>
                No recent orders found.
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Hero</th>
                    <th style={thStyle}>Order</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <td style={tdStyle}>
                        {order.orderDate
                          ? new Date(order.orderDate + "T00:00:00").toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "--"}
                      </td>
                      <td style={{ ...tdStyle, color: "var(--text-bright)", fontWeight: 500 }}>
                        {order.heroName}
                      </td>
                      <td style={tdStyle}>{order.orderNumber}</td>
                      <td style={tdStyle}>
                        <TypeBadge type={order.orderType} />
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={order.status} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{order.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Hero Leaderboard */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <span className="card-title">Hero Leaderboard</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              Top 10 by total bracelets
            </span>
          </div>
          <div style={{ maxHeight: 440, overflowY: "auto" }}>
            {heroLeaderboard.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 12 }}>
                No bracelet data yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {heroLeaderboard.map((hero, i) => {
                  const maxBracelets = heroLeaderboard[0]?.totalBracelets || 1;
                  const barPct = (hero.totalBracelets / maxBracelets) * 100;
                  return (
                    <div
                      key={hero.heroId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 14px",
                        borderBottom: "1px solid var(--card-border)",
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: i < 3 ? "var(--status-gold, #f39c12)" : "var(--text-dim)",
                          background: i < 3 ? "rgba(243, 156, 18, 0.12)" : "rgba(255,255,255,0.04)",
                          borderRadius: "50%",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text-bright)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {hero.heroName}
                        </div>
                        <div
                          style={{
                            height: 4,
                            marginTop: 4,
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${barPct}%`,
                              height: "100%",
                              background: i < 3 ? "#f39c12" : "#3498db",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text-bright)",
                          flexShrink: 0,
                        }}
                      >
                        {hero.totalBracelets}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Inventory Table (if >8 items) */}
      {inventory.length > 8 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Full Inventory</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {inventory.length} heroes with stock ({inventoryTotal} total)
            </span>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                  <th style={thStyle}>Hero</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Branch</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>7"</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>6"</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <td style={{ ...tdStyle, color: "var(--text-bright)", fontWeight: 500 }}>
                      {item.name}
                    </td>
                    <td style={tdStyle}>{item.sku}</td>
                    <td style={tdStyle}>{item.branch}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{item.onHand7}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{item.onHand6}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 900px) {
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const thStyle = {
  textAlign: "left",
  padding: "8px 10px",
  color: "var(--text-dim)",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle = {
  padding: "7px 10px",
  color: "var(--text-dim)",
};

function StatCard({ label, value, note, accent }) {
  return (
    <div className="stat-block" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {note && (
        <div className="stat-note" style={{ color: "var(--text-dim)" }}>
          {note}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#95a5a6";
  const label = STATUS_LABELS[status] || status;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color,
        background: `${color}18`,
        padding: "2px 7px",
        borderRadius: "var(--radius-sm)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function TypeBadge({ type }) {
  const isPaid = type === "paid";
  const color = isPaid ? "#2ecc71" : "#e67e22";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color,
        background: `${color}15`,
        padding: "2px 7px",
        borderRadius: "var(--radius-sm)",
        textTransform: "capitalize",
      }}
    >
      {type || "unknown"}
    </span>
  );
}

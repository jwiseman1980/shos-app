"use client";

import { useState, useEffect } from "react";

export default function FinanceKPIDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/finance/dashboard")
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
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
        Loading finance KPIs from Supabase...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 20, color: "var(--status-red)", fontSize: 13 }}>
        {error}
      </div>
    );
  }

  const { ytd, orderStats, donatedStats, months, expenseByCategory, topHeroes, costPerBracelet } = data;
  const maxRevenue = Math.max(1, ...months.map((m) => m.revenue));

  return (
    <>
      {/* YTD Big Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="YTD Revenue"
          value={`$${ytd.revenue.toLocaleString()}`}
          note={`${orderStats.totalBraceletsSold} bracelets sold`}
          accent="var(--status-green)"
        />
        <StatCard
          label="YTD Donations"
          value={`$${ytd.donations.toLocaleString()}`}
          note="Monetary gifts received"
          accent="var(--status-blue)"
        />
        <StatCard
          label="YTD Expenses"
          value={`$${ytd.expenses.toLocaleString()}`}
          note={Object.keys(expenseByCategory).length > 0
            ? `${Object.keys(expenseByCategory).length} categories`
            : "No expenses recorded"}
          accent="var(--status-red)"
        />
        <StatCard
          label="YTD Net"
          value={`$${ytd.net.toLocaleString()}`}
          note="Revenue + Donations - Expenses"
          accent={ytd.net >= 0 ? "var(--gold)" : "var(--status-red)"}
        />
      </div>

      {/* Order Stats Row */}
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: 24,
        flexWrap: "wrap",
      }}>
        <MiniPill label="Paid Orders" value={orderStats.totalPaidOrders.toLocaleString()} />
        <MiniPill label="Avg Order Value" value={`$${orderStats.avgOrderValue.toFixed(2)}`} />
        <MiniPill label="Total Revenue (All Time)" value={`$${orderStats.totalRevenue.toLocaleString()}`} />
        <MiniPill label="Cost Per Bracelet" value={`~$${costPerBracelet.toFixed(2)}`} />
        <MiniPill label="Donated Orders (YTD)" value={donatedStats.ytdDonatedOrders.toLocaleString()} />
        <MiniPill label="Donated Qty (YTD)" value={donatedStats.ytdDonatedQty.toLocaleString()} />
      </div>

      {/* Monthly Revenue Trend */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Monthly Revenue Trend (Last 6 Months)</span>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            height: 180,
            borderBottom: "1px solid var(--card-border)",
            paddingBottom: 8,
          }}>
            {months.map((m) => {
              const pct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
              return (
                <div
                  key={m.key}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title={`${m.label}: $${m.revenue.toLocaleString()}`}
                >
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: m.revenue > 0 ? "var(--status-green)" : "var(--text-dim)",
                  }}>
                    {m.revenue > 0 ? `$${m.revenue.toLocaleString()}` : "$0"}
                  </span>
                  <div style={{
                    width: "100%",
                    maxWidth: 60,
                    height: `${Math.max(pct, 2)}%`,
                    background: m.revenue > 0
                      ? "linear-gradient(to top, rgba(39,174,96,0.5), rgba(39,174,96,0.8))"
                      : "rgba(255,255,255,0.05)",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s ease",
                  }} />
                </div>
              );
            })}
          </div>
          {/* Month labels */}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {months.map((m) => (
              <div key={m.key} style={{
                flex: 1,
                textAlign: "center",
                fontSize: 11,
                color: "var(--text-dim)",
                fontWeight: 500,
              }}>
                {m.label}
              </div>
            ))}
          </div>
          {/* Summary row */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--text-dim)",
            paddingTop: 12,
            marginTop: 12,
            borderTop: "1px solid var(--card-border)",
          }}>
            <span>
              Revenue: <span style={{ color: "var(--status-green)", fontWeight: 600 }}>
                ${months.reduce((s, m) => s + m.revenue, 0).toLocaleString()}
              </span>
            </span>
            <span>
              Donations: <span style={{ color: "var(--status-blue)", fontWeight: 600 }}>
                ${months.reduce((s, m) => s + m.donations, 0).toLocaleString()}
              </span>
            </span>
            <span>
              Expenses: <span style={{ color: "var(--status-red)", fontWeight: 600 }}>
                ${months.reduce((s, m) => s + m.expenses, 0).toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column: Donated vs Paid + Top Heroes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Donated vs Paid Breakdown */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <span className="card-title">Paid vs Donated Breakdown</span>
          </div>
          <div style={{ padding: 16 }}>
            <BreakdownBar
              paid={orderStats.totalPaidOrders}
              donated={donatedStats.ytdDonatedOrders}
            />
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <MetricRow label="Paid Orders" value={orderStats.totalPaidOrders} color="var(--status-green)" />
                <MetricRow label="Donated Orders (YTD)" value={donatedStats.ytdDonatedOrders} color="var(--gold)" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <MetricRow label="Bracelets Sold" value={orderStats.totalBraceletsSold} color="var(--status-green)" />
                <MetricRow label="Bracelets Donated (YTD)" value={donatedStats.ytdDonatedQty} color="var(--gold)" />
              </div>
            </div>

            {/* Cost Analysis */}
            <div style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "var(--bg)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--card-border)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Unit Economics
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)" }}>
                    ~${costPerBracelet.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Cost per bracelet</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--status-green)" }}>
                    ${orderStats.avgOrderValue > 0 ? (orderStats.avgOrderValue - costPerBracelet).toFixed(2) : "0.00"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Gross margin / unit</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>
                    {orderStats.avgOrderValue > 0
                      ? `${Math.round(((orderStats.avgOrderValue - costPerBracelet) / orderStats.avgOrderValue) * 100)}%`
                      : "--"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Gross margin %</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Heroes by Bracelet Sales */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <span className="card-title">Top Heroes by Bracelet Sales</span>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>All-time paid orders</span>
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {topHeroes.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-dim)", fontSize: 13 }}>
                No hero sales data yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px" }}>
                {topHeroes.map((hero, i) => (
                  <div
                    key={hero.heroId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      background: i < 3 ? "rgba(241,196,15,0.05)" : "transparent",
                      borderRadius: "var(--radius-sm)",
                      borderLeft: i < 3 ? "3px solid var(--gold)" : "3px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: i < 3 ? "var(--gold)" : "var(--text-dim)",
                        minWidth: 18,
                        textAlign: "center",
                      }}>
                        {i + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-bright)" }}>
                          {hero.heroName}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                          {hero.totalQty} bracelet{hero.totalQty !== 1 ? "s" : ""} sold
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--status-green)",
                      whiteSpace: "nowrap",
                    }}>
                      ${hero.totalRevenue.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Breakdown by Category */}
      {Object.keys(expenseByCategory).length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">YTD Expense Breakdown by Category</span>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(expenseByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => {
                  const pct = ytd.expenses > 0 ? (amount / ytd.expenses) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}>
                        <span style={{ color: "var(--text-bright)", textTransform: "capitalize" }}>
                          {cat.replace(/_/g, " ")}
                        </span>
                        <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>
                          ${Math.round(amount).toLocaleString()} ({Math.round(pct)}%)
                        </span>
                      </div>
                      <div style={{
                        height: 6,
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "var(--status-red)",
                          borderRadius: 3,
                          opacity: 0.7,
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Responsive override */}
      <style>{`
        @media (max-width: 768px) {
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, note, accent }) {
  return (
    <div
      className="stat-block"
      style={{ borderTop: `3px solid ${accent}` }}
    >
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

function MiniPill({ label, value }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 12px",
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: "var(--radius-sm)",
      fontSize: 12,
      color: "var(--text-dim)",
    }}>
      <span style={{ fontWeight: 600, color: "var(--text-bright)" }}>{value}</span>
      {label}
    </span>
  );
}

function MetricRow({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

function BreakdownBar({ paid, donated }) {
  const total = paid + donated;
  if (total === 0) {
    return (
      <div style={{
        height: 20,
        background: "rgba(255,255,255,0.05)",
        borderRadius: "var(--radius-sm)",
      }} />
    );
  }
  const paidPct = (paid / total) * 100;
  return (
    <div style={{
      display: "flex",
      height: 20,
      borderRadius: "var(--radius-sm)",
      overflow: "hidden",
    }}>
      <div
        style={{
          width: `${paidPct}%`,
          background: "rgba(39,174,96,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          color: "#fff",
        }}
        title={`Paid: ${paid}`}
      >
        {paidPct > 15 ? `${Math.round(paidPct)}%` : ""}
      </div>
      <div
        style={{
          width: `${100 - paidPct}%`,
          background: "rgba(241,196,15,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          color: "#fff",
        }}
        title={`Donated: ${donated}`}
      >
        {(100 - paidPct) > 15 ? `${Math.round(100 - paidPct)}%` : ""}
      </div>
    </div>
  );
}

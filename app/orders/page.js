export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import OrderBoard from "@/components/OrderBoard";
import OrdersTable from "@/components/OrdersTable";
import SyncOrdersButton from "@/components/SyncOrdersButton";
import LaserDoneButton from "@/components/LaserDoneButton";
import Link from "next/link";
import {
  getGroupedOrders,
  getOrderStats,
  getItemsByStatus,
  getHistoricalStats,
  getTopHeroesByOrders,
  getOrderTypeSummary,
} from "@/lib/data/orders";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META = {
  paid:        { label: "Paid",        color: "#22c55e",  description: "Customer purchases via Squarespace" },
  donated:     { label: "Donated",     color: "#c4a237",  description: "Free bracelets to families, events, partners" },
  wholesale:   { label: "Wholesale",   color: "#8b5cf6",  description: "Bulk partner / reseller orders" },
  gift:        { label: "Gift",        color: "#ec4899",  description: "Gifted by Steel Hearts" },
  replacement: { label: "Replacement", color: "#64748b",  description: "Replaced defective / lost bracelets" },
};

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, color: "var(--text-dim)",
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ─── Pipeline item ────────────────────────────────────────────────────────────

function PipelineItem({ item, showDownload, showDone, doneStatus, doneLabel, doneColor }) {
  const hero = item.heroName || item.sku || "—";
  const size = item.size ? `${item.size}"` : "";
  const qty  = item.quantity || 1;
  return (
    <div style={{
      padding: "7px 0",
      borderBottom: "1px solid var(--card-border)",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", lineHeight: 1.3 }}>
          {hero}{size ? ` · ${size}` : ""} (x{qty})
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
          #{item.orderNumber}{item.customerName ? ` · ${item.customerName}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
        {showDownload && item.hasDesign && item.designUrl && (
          <a href={item.designUrl} target="_blank" rel="noopener" style={{
            fontSize: 10, fontWeight: 600, color: "var(--status-green)",
            textDecoration: "none", padding: "2px 6px", borderRadius: 4,
            border: "1px solid var(--status-green)", whiteSpace: "nowrap",
          }}>
            ⬇ SVG
          </a>
        )}
        {showDownload && !item.hasDesign && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "var(--status-orange)",
            padding: "2px 6px", borderRadius: 4, border: "1px solid var(--status-orange)",
          }}>
            Needs Design
          </span>
        )}
        {showDone && (
          <LaserDoneButton
            itemId={item.id}
            heroName={item.heroName}
            toStatus={doneStatus}
            label={doneLabel}
            color={doneColor}
          />
        )}
      </div>
    </div>
  );
}

function PipelineColumn({ title, items, href, accent, emptyText, showDownload, showDone, doneStatus, doneLabel, doneColor }) {
  const shown    = items.slice(0, 8);
  const overflow = items.length - shown.length;
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)" }}>{title}</span>
          <span style={{ fontSize: 11, background: accent + "22", color: accent, borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
            {items.length}
          </span>
        </div>
        <Link href={href} style={{ fontSize: 11, color: "var(--text-dim)", textDecoration: "none" }}>
          View all →
        </Link>
      </div>
      <div style={{ padding: "0 14px" }}>
        {shown.length === 0 ? (
          <div style={{ padding: "16px 0", fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
            {emptyText}
          </div>
        ) : (
          <>
            {shown.map((item) => (
              <PipelineItem
                key={item.id}
                item={item}
                showDownload={showDownload}
                showDone={showDone}
                doneStatus={doneStatus}
                doneLabel={doneLabel}
                doneColor={doneColor}
              />
            ))}
            {overflow > 0 && (
              <div style={{ padding: "8px 0", fontSize: 11, color: "var(--text-dim)" }}>
                +{overflow} more — <Link href={href} style={{ color: "var(--text-dim)" }}>view all</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Order type breakdown card ────────────────────────────────────────────────

function TypeBreakdownCard({ summary }) {
  if (!summary || summary.length === 0) return null;
  const totalBracelets = summary.reduce((s, r) => s + r.braceletCount, 0);

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)" }}>
            Bracelet Movement by Type
          </span>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {totalBracelets.toLocaleString()} total
        </span>
      </div>
      <div style={{ padding: "6px 0" }}>
        {summary.map((row) => {
          const meta = TYPE_META[row.type] || { label: row.type, color: "#6b7280", description: "" };
          const pct  = totalBracelets > 0 ? (row.braceletCount / totalBracelets) * 100 : 0;
          return (
            <div key={row.type} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "7px 16px",
              borderBottom: "1px solid var(--card-border)",
            }}>
              {/* Color dot + name */}
              <div style={{ flex: "0 0 110px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
              </div>

              {/* Bar */}
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--card-border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: meta.color, borderRadius: 3, minWidth: row.braceletCount > 0 ? 4 : 0 }} />
              </div>

              {/* Stats */}
              <div style={{ flex: "0 0 170px", display: "flex", gap: 16, justifyContent: "flex-end" }}>
                <span style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 600, minWidth: 40, textAlign: "right" }}>
                  {row.braceletCount.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)", minWidth: 50, textAlign: "right" }}>
                  {row.orderCount} orders
                </span>
                {row.revenue > 0 && (
                  <span style={{ fontSize: 11, color: "var(--status-green)", minWidth: 60, textAlign: "right" }}>
                    ${row.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Quick filter links — navigate to ?type=X#history to pre-filter the table */}
      <div style={{ padding: "8px 16px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Jump to history:</span>
        {summary.map((row) => {
          const meta = TYPE_META[row.type] || { label: row.type, color: "#6b7280" };
          return (
            <a
              key={row.type}
              href={`/orders?type=${row.type}#history`}
              style={{
                fontSize: 11, fontWeight: 600,
                color: meta.color,
                textDecoration: "none",
                padding: "1px 8px",
                borderRadius: 10,
                background: meta.color + "18",
                border: `1px solid ${meta.color}33`,
              }}
            >
              {meta.label} →
            </a>
          );
        })}
        {summary.length > 0 && (
          <a
            href="/orders#history"
            style={{
              fontSize: 11, color: "var(--text-dim)",
              textDecoration: "none", padding: "1px 8px",
              borderRadius: 10, border: "1px solid var(--card-border)",
            }}
          >
            All
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Top Heroes card ──────────────────────────────────────────────────────────

function TopHeroesCard({ heroes }) {
  if (!heroes || heroes.length === 0) return null;
  const max = heroes[0]?.totalQty || 1;
  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)" }}>Top Heroes · Paid Sales</span>
      </div>
      <div style={{ padding: "6px 16px 12px" }}>
        {heroes.map((h, i) => (
          <div key={h.heroId} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "5px 0",
            borderBottom: i < heroes.length - 1 ? "1px solid var(--card-border)" : "none",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", minWidth: 18, textAlign: "right" }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.heroName}
              </div>
              <div style={{ height: 3, marginTop: 3, borderRadius: 2, background: "var(--card-border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round((h.totalQty / max) * 100)}%`, background: "var(--gold)", borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>{h.totalQty}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{h.lineCount} orders</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrdersPage({ searchParams }) {
  let orders = [], stats = {};
  let designItems = [], laserItems = [], shipItems = [];
  let historicalStats = {};
  let topHeroes = [];
  let typeSummary = [];

  try {
    [orders, stats, designItems, laserItems, shipItems, historicalStats, topHeroes, typeSummary] =
      await Promise.all([
        getGroupedOrders(),
        getOrderStats(),
        Promise.all([
          getItemsByStatus("design_needed"),
          getItemsByStatus("not_started"),
        ]).then(([a, b]) => [...a, ...b]).catch(() => []),
        Promise.all([
          getItemsByStatus("ready_to_laser"),
          getItemsByStatus("in_production"),
        ]).then(([a, b]) => [...a, ...b]).catch(() => []),
        getItemsByStatus("ready_to_ship").catch(() => []),
        getHistoricalStats().catch(() => ({})),
        getTopHeroesByOrders(12).catch(() => []),
        getOrderTypeSummary().catch(() => []),
      ]);
  } catch (err) {
    console.error("Order page load error:", err.message);
  }

  const hs = {
    totalSold: 0, totalDonated: 0, totalRevenue: 0,
    soldThisYear: 0, soldThisMonth: 0, revenueThisYear: 0, revenueThisMonth: 0,
    ...historicalStats,
  };

  const activeTotal = (stats.designNeeded || 0) + (stats.readyToLaser || 0) +
    (stats.inProduction || 0) + (stats.readyToShip || 0);

  // URL-driven table initialization — lets TypeBreakdownCard quick-filter links work
  const urlType   = (await searchParams)?.type   || "";
  const urlStatus = (await searchParams)?.status || "";

  return (
    <PageShell
      title="Orders"
      subtitle="Single source of truth — paid sales, donated, wholesale, gifts, replacements"
      action={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/bracelets/donate"
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 14px",
              borderRadius: 6, background: "var(--gold)", color: "#000",
              textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            + Log Donation
          </Link>
          <SyncOrdersButton />
        </div>
      }
    >

      {/* ── 1. Pipeline summary ── */}
      <div className="stat-grid">
        <StatBlock
          label="Active Orders"
          value={activeTotal}
          note={`${stats.totalPaid || 0} paid · ${stats.totalDonated || 0} donated`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Needs Design"
          value={stats.designNeeded || 0}
          note="Not started or design needed"
          accent="var(--status-orange)"
        />
        <StatBlock
          label="In Production"
          value={(stats.readyToLaser || 0) + (stats.inProduction || 0)}
          note={`${stats.readyToLaser || 0} laser · ${stats.inProduction || 0} active`}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Ready to Ship"
          value={stats.readyToShip || 0}
          note="Pending fulfillment"
          accent="var(--status-green)"
        />
        <StatBlock
          label="Shipped"
          value={stats.shipped || 0}
          note="All time"
          accent="var(--status-gray)"
        />
      </div>

      {/* ── 2. All-time totals ── */}
      <div className="section">
        <SectionLabel>All-Time Totals</SectionLabel>
        <div className="stat-grid">
          <StatBlock
            label="Bracelets Sold"
            value={hs.totalSold.toLocaleString()}
            note={`${hs.soldThisYear.toLocaleString()} this year · ${hs.soldThisMonth.toLocaleString()} this month`}
            accent="var(--gold)"
          />
          <StatBlock
            label="Bracelets Donated"
            value={hs.totalDonated.toLocaleString()}
            note="Families, events, partners"
            accent="var(--gold)"
          />
          <StatBlock
            label="Revenue"
            value={`$${hs.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            note={`$${hs.revenueThisYear.toLocaleString()} this year`}
            accent="var(--status-green)"
          />
          <StatBlock
            label="Charity Raised"
            value={`$${(hs.totalSold * 10).toLocaleString()}`}
            note="$10 per bracelet sold"
            accent="var(--status-green)"
          />
        </div>
      </div>

      {/* ── 3. Bracelet movement by type + top heroes ── */}
      <div className="section">
        <SectionLabel>Bracelet Movement by Type</SectionLabel>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <TypeBreakdownCard summary={typeSummary} />
          </div>
          {topHeroes.length > 0 && (
            <div style={{ flex: "0 0 260px", minWidth: 220 }}>
              <TopHeroesCard heroes={topHeroes} />
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Production pipeline ── */}
      <div className="section">
        <SectionLabel>Production Pipeline</SectionLabel>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <PipelineColumn
            title="Design"
            items={designItems}
            href="/designs"
            accent="var(--status-orange)"
            emptyText="No designs needed"
          />
          <PipelineColumn
            title="Laser"
            items={laserItems}
            href="/laser"
            accent="var(--status-blue)"
            emptyText="Laser queue clear"
            showDownload
            showDone
            doneStatus="ready_to_ship"
            doneLabel="✓ Done"
            doneColor="var(--status-blue)"
          />
          <PipelineColumn
            title="Ship"
            items={shipItems}
            href="/shipping"
            accent="var(--status-green)"
            emptyText="Nothing to ship"
            showDone
            doneStatus="shipped"
            doneLabel="📦 Shipped"
            doneColor="var(--status-green)"
          />
        </div>
      </div>

      {/* ── 5. Active order board ── */}
      <div className="section">
        <SectionLabel>Active Order Board</SectionLabel>
        <OrderBoard orders={orders} />
      </div>

      {/* ── 6. Full history table ── */}
      <div className="section" id="history" style={{ scrollMarginTop: 80 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel>Order History</SectionLabel>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            All orders · server-side search + filter · paginated
          </span>
        </div>

        <OrdersTable
          key={urlType + "|" + urlStatus}
          initialType={urlType}
          initialStatus={urlStatus}
        />
      </div>

    </PageShell>
  );
}

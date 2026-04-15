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
  getAllOrderItems,
  getTopHeroesByOrders,
} from "@/lib/data/orders";

// ─── Pipeline item row ────────────────────────────────────────────────────────

function PipelineItem({ item, showDownload, showDone, doneStatus, doneLabel, doneColor }) {
  const hero = item.heroName || item.sku || "—";
  const size = item.size ? `${item.size}"` : "";
  const qty = item.quantity || 1;
  const needsDesign = showDownload && !item.hasDesign;
  return (
    <div data-pipeline-item style={{
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
        {needsDesign && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "var(--status-orange)",
            padding: "2px 6px", borderRadius: 4,
            border: "1px solid var(--status-orange)", whiteSpace: "nowrap",
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

function PipelineColumn({ title, items, href, accent, emptyText, showDownload, showDone, doneStatus, doneLabel, doneColor, unit }) {
  const shown = items.slice(0, 8);
  const overflow = items.length - shown.length;
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)" }}>{title}</span>
          <span style={{
            fontSize: 11, background: accent + "22", color: accent,
            borderRadius: 10, padding: "1px 7px", fontWeight: 600,
          }}>{items.length}{unit ? ` ${unit}` : ""}</span>
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

// ─── Top Heroes card ──────────────────────────────────────────────────────────

function TopHeroesCard({ heroes }) {
  if (!heroes || heroes.length === 0) return null;
  const max = heroes[0]?.totalQty || 1;
  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--card-border)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--card-border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-bright)" }}>Top Heroes by Sales</span>
        <span style={{
          fontSize: 11, background: "var(--gold-soft)", color: "var(--gold)",
          borderRadius: 10, padding: "1px 7px", fontWeight: 600,
        }}>Paid orders</span>
      </div>
      <div style={{ padding: "8px 16px 12px" }}>
        {heroes.map((h, i) => (
          <div key={h.heroId} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "5px 0",
            borderBottom: i < heroes.length - 1 ? "1px solid var(--card-border)" : "none",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: "var(--text-dim)",
              minWidth: 18, textAlign: "right",
            }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.heroName}
              </div>
              <div style={{ height: 4, marginTop: 3, borderRadius: 2, background: "var(--card-border)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.round((h.totalQty / max) * 100)}%`,
                  background: "var(--gold)",
                  borderRadius: 2,
                }} />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>{h.totalQty}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                {h.lineCount} order{h.lineCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrdersPage() {
  let orders = [], stats = {};
  let designItems = [], laserItems = [], shipItems = [];
  let historicalStats = {};
  let allItems = [];
  let topHeroes = [];

  try {
    [orders, stats, designItems, laserItems, shipItems, historicalStats, allItems, topHeroes] =
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
        getAllOrderItems(750).catch(() => []),
        getTopHeroesByOrders(12).catch(() => []),
      ]);
  } catch (err) {
    console.error("Order page load error:", err.message);
  }

  const hs = {
    totalSold: 0, totalDonated: 0, totalRevenue: 0,
    soldThisYear: 0, soldThisMonth: 0, revenueThisYear: 0, revenueThisMonth: 0,
    ...historicalStats,
  };

  const activeTotal = (stats.designNeeded || 0) + (stats.readyToLaser || 0) + (stats.inProduction || 0) + (stats.readyToShip || 0);
  const shippedLast30 = allItems.filter((i) => {
    if (i.productionStatus !== "shipped") return false;
    const d = i.orderDate || i.createdAt;
    if (!d) return false;
    const ms = new Date() - new Date(d);
    return ms <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <PageShell title="Orders" subtitle="Pipeline · History · Analytics" action={<SyncOrdersButton />}>

      {/* ── Pipeline summary ── */}
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
          label="Shipped (30d)"
          value={shippedLast30}
          note={`${stats.shipped || 0} total shipped`}
          accent="var(--status-gray)"
        />
      </div>

      {/* ── Historical stats ── */}
      <div className="section">
        <SectionLabel>All-Time Stats</SectionLabel>
        <div className="stat-grid">
          <StatBlock
            label="Bracelets Sold"
            value={hs.totalSold.toLocaleString()}
            note={`${hs.soldThisYear} this year · ${hs.soldThisMonth} this month`}
            accent="var(--gold)"
          />
          <StatBlock
            label="Bracelets Donated"
            value={hs.totalDonated.toLocaleString()}
            note="Donated orders all-time"
            accent="var(--gold)"
          />
          <StatBlock
            label="Total Revenue"
            value={`$${hs.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            note={`$${hs.revenueThisYear.toLocaleString()} this year · $${hs.revenueThisMonth.toLocaleString()} this month`}
            accent="var(--status-green)"
          />
          <StatBlock
            label="Charity Raised"
            value={`$${(hs.totalSold * 10).toLocaleString()}`}
            note="$10 obligation per bracelet sold"
            accent="var(--status-green)"
          />
        </div>
      </div>

      {/* ── Production Pipeline ── */}
      <div className="section">
        <SectionLabel>Production Pipeline</SectionLabel>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <PipelineColumn
            title="Design"
            items={designItems}
            href="/designs"
            accent="var(--status-orange)"
            emptyText="No designs needed"
            unit="items"
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
            unit="items"
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
            unit="items"
          />
        </div>
      </div>

      {/* ── Active orders board + Top heroes ── */}
      <div className="section">
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <SectionLabel>Active Order Board</SectionLabel>
            <OrderBoard orders={orders} />
          </div>
          {topHeroes.length > 0 && (
            <div style={{ flex: "0 0 260px", minWidth: 220 }}>
              <SectionLabel>Top Heroes</SectionLabel>
              <TopHeroesCard heroes={topHeroes} />
            </div>
          )}
        </div>
      </div>

      {/* ── Full order history ── */}
      <div className="section">
        <SectionLabel>Order History ({allItems.length} items)</SectionLabel>
        <OrdersTable items={allItems} />
      </div>

    </PageShell>
  );
}

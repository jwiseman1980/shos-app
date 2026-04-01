export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import OrderBoard from "@/components/OrderBoard";
import SyncOrdersButton from "@/components/SyncOrdersButton";
import Link from "next/link";
import { getGroupedOrders, getOrderStats, getItemsByStatus } from "@/lib/data/orders";

const STATUS_LABEL = {
  not_started: "Not started",
  design_needed: "Design needed",
  ready_to_laser: "Ready",
  in_production: "In progress",
  ready_to_ship: "Ready",
};

function PipelineItem({ item }) {
  const hero = item.heroName || item.sku || "—";
  const size = item.size ? `${item.size}"` : "";
  return (
    <div style={{
      padding: "7px 0",
      borderBottom: "1px solid var(--card-border)",
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", lineHeight: 1.3 }}>
        {hero}{size ? ` · ${size}` : ""}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
        #{item.orderNumber}{item.customerName ? ` · ${item.customerName}` : ""}
      </div>
    </div>
  );
}

function PipelineColumn({ title, items, href, accent, emptyText }) {
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
          }}>{items.length}</span>
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
            {shown.map((item) => <PipelineItem key={item.id} item={item} />)}
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

export default async function OrdersPage() {
  let orders = [], stats = {};
  let designItems = [], laserItems = [], shipItems = [];

  try {
    [orders, stats, designItems, laserItems, shipItems] = await Promise.all([
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
    ]);
  } catch (err) {
    console.error("Order page load error:", err.message);
  }

  return (
    <PageShell title="Order Queue" subtitle="Fulfillment pipeline — Salesforce + ShipStation" action={<SyncOrdersButton />}>
      <div className="stat-grid">
        <StatBlock
          label="Design Queue"
          value={(stats.designNeeded || 0) + (stats.designInProgress || 0)}
          note={`${stats.designNeeded || 0} needed \u00b7 ${stats.designInProgress || 0} in progress`}
          accent="var(--status-orange)"
        />
        <StatBlock
          label="In Production"
          value={(stats.readyToLaser || 0) + (stats.inProduction || 0)}
          note={`${stats.readyToLaser || 0} laser \u00b7 ${stats.inProduction || 0} active`}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Ready to Ship"
          value={stats.readyToShip || 0}
          note="Pending fulfillment"
          accent="var(--status-green)"
        />
        <StatBlock
          label="Total Orders"
          value={(stats.totalPaid || 0) + (stats.totalDonated || 0)}
          note={`${stats.totalPaid || 0} paid \u00b7 ${stats.totalDonated || 0} donated`}
          accent="var(--gold)"
        />
      </div>

      {/* Production Pipeline */}
      <div className="section">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Production Pipeline
        </div>
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
          />
          <PipelineColumn
            title="Ship"
            items={shipItems}
            href="/shipping"
            accent="var(--status-green)"
            emptyText="Nothing to ship"
          />
        </div>
      </div>

      <div className="section">
        <OrderBoard orders={orders} />
      </div>
    </PageShell>
  );
}

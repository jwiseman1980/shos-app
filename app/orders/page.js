export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import OrderTracker from "@/components/OrderTracker";
import DonateForm from "@/components/DonateForm";

async function loadData() {
  // Only load from Notion if configured
  if (!process.env.NOTION_API_KEY) {
    return { orders: [], stats: { total: 0, active: 0, totalUnits: 0, statusCounts: {}, typeCounts: {} } };
  }
  const { getOrders, getOrderStats } = await import("@/lib/data/orders");
  const [orders, stats] = await Promise.all([getOrders(), getOrderStats()]);
  return { orders, stats };
}

export default async function OrdersPage() {
  const { orders, stats } = await loadData();

  const activeOrders = orders.filter(
    (o) => !["Shipped", "Complete", "Cancelled", "Synced to Salesforce"].includes(o.status)
  );
  const shippedOrders = orders.filter(
    (o) => o.status === "Shipped" || o.status === "Complete" || o.status === "Synced to Salesforce"
  );

  return (
    <PageShell
      title="Order Queue"
      subtitle={`${stats.active} active orders — ${stats.totalUnits} total bracelets`}
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Active Orders"
          value={stats.active}
          accent="var(--gold)"
        />
        <StatBlock
          label="Total Orders"
          value={stats.total}
          accent="var(--text-dim)"
        />
        <StatBlock
          label="Total Units"
          value={stats.totalUnits}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Donated"
          value={stats.typeCounts?.["Donated"] || 0}
          accent="var(--status-purple)"
        />
        <StatBlock
          label="Paid"
          value={stats.typeCounts?.["Paid"] || 0}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Design Needed"
          value={stats.statusCounts?.["Design Needed"] || 0}
          accent="var(--status-orange)"
        />
      </div>

      {/* Pipeline Summary */}
      {stats.total > 0 && (
        <DataCard title="Pipeline">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Intake", "Needs Decision", "Design Needed", "Ready to Laser", "Produced", "Ready to Ship"].map((s) => (
              <div
                key={s}
                style={{
                  padding: "8px 12px",
                  background: "var(--bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                  minWidth: 90,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-bright)" }}>
                  {stats.statusCounts?.[s] || 0}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{s}</div>
              </div>
            ))}
          </div>
        </DataCard>
      )}

      {/* Active Orders Table */}
      <DataCard title={`Active Orders — ${activeOrders.length}`}>
        <OrderTracker orders={activeOrders} />
      </DataCard>

      {/* Donate Bracelet Form */}
      <DataCard title="Submit Donated Bracelet Request">
        <DonateForm />
      </DataCard>

      {/* Shipped / Completed */}
      {shippedOrders.length > 0 && (
        <DataCard title={`Shipped / Completed — ${shippedOrders.length}`}>
          <OrderTracker orders={shippedOrders} />
        </DataCard>
      )}

      {!process.env.NOTION_API_KEY && (
        <DataCard title="Setup Required">
          <p style={{ color: "var(--status-orange)", fontSize: 13 }}>
            Notion API key not configured. Add NOTION_API_KEY to your environment variables to connect
            the Order Queue from Notion.
          </p>
        </DataCard>
      )}
    </PageShell>
  );
}

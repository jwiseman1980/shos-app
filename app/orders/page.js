export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import OrderBoard from "@/components/OrderBoard";
import { getGroupedOrders, getOrderStats } from "@/lib/data/orders";

export default async function OrdersPage() {
  let orders = [], stats = {};

  try {
    [orders, stats] = await Promise.all([
      getGroupedOrders(),
      getOrderStats(),
    ]);
  } catch (err) {
    console.error("Order page load error:", err.message);
  }

  return (
    <PageShell title="Order Queue" subtitle="Fulfillment pipeline — Salesforce + ShipStation">
      <div className="stat-grid">
        <StatBlock
          label="Needs Decision"
          value={stats.needsDecision || 0}
          note="Awaiting triage"
          accent="var(--status-red)"
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

      <div className="section">
        <OrderBoard orders={orders} />
      </div>
    </PageShell>
  );
}

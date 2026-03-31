export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import ProductionBoard from "@/components/ProductionBoard";
import { getProductionBoard } from "@/lib/data/production";

export default async function ProductionPage() {
  let columns = {};
  let stats = {};

  try {
    const board = await getProductionBoard();
    columns = board.columns;
    stats = board.stats;
  } catch (err) {
    console.error("Production page load error:", err.message);
  }

  const designCount = (columns.design_needed || []).length;
  const laserCount = (columns.ready_to_laser || []).length;
  const prodCount = (columns.in_production || []).length;
  const shipCount = (columns.ready_to_ship || []).length;
  const totalActive = designCount + laserCount + prodCount + shipCount;

  return (
    <PageShell
      title="Production"
      subtitle="Bracelet pipeline \u2014 cards move left to right through production"
    >
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatBlock
          label="Active Orders"
          value={totalActive}
          note={`${stats.totalShipped?.toLocaleString() || 0} shipped all time`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Needs Design"
          value={designCount}
          note="Waiting on Ryan"
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Ready to Laser"
          value={laserCount}
          note="Waiting on Joseph"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Ready to Ship"
          value={shipCount}
          note="Waiting on Kristin"
          accent="var(--status-green)"
        />
      </div>

      <ProductionBoard columns={columns} stats={stats} />
    </PageShell>
  );
}

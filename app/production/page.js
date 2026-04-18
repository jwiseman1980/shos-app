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

  const queuedCount   = (columns.not_started    || []).length;
  const designCount   = (columns.design_needed  || []).length;
  const laserCount    = (columns.ready_to_laser || []).length;
  const prodCount     = (columns.in_production  || []).length;
  const shipCount     = (columns.ready_to_ship  || []).length;
  const totalActive   = queuedCount + designCount + laserCount + prodCount + shipCount;

  return (
    <PageShell
      title="Production Pipeline"
      subtitle="Every active order — from design request through laser to shipped"
    >
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatBlock
          label="Active Items"
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
          note="Download SVG → burn"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="In Production"
          value={prodCount}
          note="Actively lasering"
          accent="#00bcd4"
        />
        <StatBlock
          label="Ready to Ship"
          value={shipCount}
          note="Push to ShipStation"
          accent="var(--status-green)"
        />
      </div>

      <ProductionBoard columns={columns} stats={stats} />
    </PageShell>
  );
}

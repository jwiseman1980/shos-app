export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import { getOrderDesignQueue, getDesignStats, getProactiveQueue } from "@/lib/data/designs";
import DesignWorkQueue from "@/components/DesignWorkQueue";

export default async function DesignsPage() {
  let items = [];
  let stats = {};
  let proactiveItems = [];

  try {
    [items, stats, proactiveItems] = await Promise.all([
      getOrderDesignQueue(),
      getDesignStats(),
      getProactiveQueue(),
    ]);
  } catch (err) {
    console.error("Design page load error:", err.message);
  }

  const needDesign = items.filter((i) => !i.hasDesign);
  const hasDesign = items.filter((i) => i.hasDesign);

  return (
    <PageShell
      title="Design Queue"
      subtitle="Bracelet designs needed for open orders"
    >
      <div className="stat-grid">
        <StatBlock
          label="Needs Design"
          value={needDesign.length}
          note="Order items without designs"
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Has Design"
          value={hasDesign.length}
          note="Ready to advance to laser"
          accent="var(--status-green)"
        />
        <StatBlock
          label="In Progress"
          value={stats.inProgress || 0}
          note="Designs being worked on"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Completed"
          value={stats.complete || 0}
          note="All time"
          accent="var(--gold)"
        />
      </div>

      <div className="section">
        <DesignWorkQueue items={items} proactiveItems={proactiveItems} />
      </div>
    </PageShell>
  );
}

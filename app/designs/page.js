export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import { getOrderDesignQueue, getDesignStats, getProactiveQueue } from "@/lib/data/designs";
import { listDesigns } from "@/lib/design-storage";
import { getServerClient } from "@/lib/supabase";
import DesignWorkQueue from "@/components/DesignWorkQueue";
import DesignCatalog from "@/components/DesignCatalog";

async function getCatalogDesigns() {
  const raw = await listDesigns();
  if (!raw || raw.length === 0) return [];

  // Enrich with hero names from Supabase
  const sb = getServerClient();
  const skus = raw.map((d) => {
    const sku = d.name.replace(/\.svg$/, "");
    const baseSku = sku.replace(/-[67]D?$/, "").replace(/-D$/, "");
    const sizeMatch = sku.match(/-([67])D?$/);
    return { ...d, sku, baseSku, size: sizeMatch ? sizeMatch[1] : null };
  });

  // Batch fetch hero names
  const uniqueBaseSkus = [...new Set(skus.map((s) => s.baseSku))];
  const heroMap = {};
  for (let i = 0; i < uniqueBaseSkus.length; i += 50) {
    const batch = uniqueBaseSkus.slice(i, i + 50);
    const { data } = await sb
      .from("heroes")
      .select("lineitem_sku, name")
      .in("lineitem_sku", batch);
    if (data) data.forEach((h) => { heroMap[h.lineitem_sku] = h.name; });
  }

  return skus.map((d) => ({
    name: d.name,
    sku: d.sku,
    baseSku: d.baseSku,
    size: d.size,
    heroName: heroMap[d.baseSku] || null,
    fileSize: d.size,
    created: d.created,
  }));
}

export default async function DesignsPage() {
  let items = [];
  let stats = {};
  let proactiveItems = [];
  let catalogDesigns = [];

  try {
    [items, stats, proactiveItems, catalogDesigns] = await Promise.all([
      getOrderDesignQueue(),
      getDesignStats(),
      getProactiveQueue(),
      getCatalogDesigns(),
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
          label="In Catalog"
          value={new Set(catalogDesigns.map(d => d.baseSku)).size}
          note={`${catalogDesigns.length} files`}
          accent="var(--gold)"
        />
      </div>

      <div className="section">
        <DesignWorkQueue items={items} proactiveItems={proactiveItems} />
      </div>

      <div className="section">
        <h3 style={{
          fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
          color: "var(--gold)", marginBottom: 12, paddingBottom: 6,
          borderBottom: "2px solid rgba(196, 162, 55, 0.13)",
        }}>
          Design Catalog ({catalogDesigns.length})
        </h3>
        <DesignCatalog designs={catalogDesigns} />
      </div>
    </PageShell>
  );
}

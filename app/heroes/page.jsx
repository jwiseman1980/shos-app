export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import HeroCatalog from "@/components/HeroCatalog";
import { getServerClient } from "@/lib/supabase";

const BRACELET_BUCKET = "bracelet-designs";

async function loadHeroes() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("heroes")
    .select(
      "id, name, first_name, last_name, rank, branch, lineitem_sku, design_status, bracelet_design_created, has_graphic_design, bio_page_url, active_listing, memorial_month, memorial_day, organization_id"
    )
    .eq("active_listing", true)
    .order("last_name", { ascending: true });

  if (error) throw new Error(`heroes query failed: ${error.message}`);
  return data || [];
}

async function loadDesignedSkus() {
  const sb = getServerClient();
  const { data, error } = await sb.storage.from(BRACELET_BUCKET).list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return new Set();
  return new Set(data.filter((f) => !f.name.includes(".")).map((f) => f.name));
}

function deriveAcademy(sku) {
  if (!sku) return null;
  const prefix = sku.split("-")[0];
  if (["USMA", "USNA", "USAFA", "USCGA", "USMMA"].includes(prefix)) return prefix;
  return null;
}

function deriveBranchPrefix(sku) {
  if (!sku) return null;
  const prefix = sku.split("-")[0];
  if (["USA", "USMC", "USN", "USAF", "USCG", "USSF", "FIRE"].includes(prefix)) return prefix;
  return null;
}

function statusFor(hero, designedSkus) {
  const hasFiles = hero.lineitem_sku && designedSkus.has(hero.lineitem_sku);
  const hasPage = Boolean(hero.bio_page_url);
  if (hasFiles && hasPage) return "live";
  if (hasFiles && !hasPage) return "no_page";
  if (!hasFiles && !hero.bracelet_design_created) return "needs_design";
  return "no_page";
}

export default async function HeroesPage() {
  const [heroes, designedSkus] = await Promise.all([
    loadHeroes().catch((err) => {
      console.error("[heroes] load failed:", err.message);
      return [];
    }),
    loadDesignedSkus().catch(() => new Set()),
  ]);

  const enriched = heroes.map((h) => {
    const sku = h.lineitem_sku || null;
    const academy = deriveAcademy(sku);
    const branchPrefix = deriveBranchPrefix(sku);
    return {
      id: h.id,
      name: h.name,
      rank: h.rank || null,
      branch: h.branch || null,
      sku,
      academy,
      branchPrefix,
      designStatus: h.design_status,
      hasFiles: sku && designedSkus.has(sku),
      hasPage: Boolean(h.bio_page_url),
      bioPage: h.bio_page_url,
      status: statusFor(h, designedSkus),
      memorialMonth: h.memorial_month,
      memorialDay: h.memorial_day,
    };
  });

  const counts = {
    total: enriched.length,
    live: enriched.filter((h) => h.status === "live").length,
    noPage: enriched.filter((h) => h.status === "no_page").length,
    needsDesign: enriched.filter((h) => h.status === "needs_design").length,
  };

  return (
    <PageShell
      title="Hero Catalog"
      subtitle={`${counts.total} active heroes — ${counts.live} live, ${counts.noPage} need a page, ${counts.needsDesign} need design`}
    >
      <HeroCatalog heroes={enriched} counts={counts} />
    </PageShell>
  );
}

import { getHeroes } from "@/lib/data/heroes";

// ---------------------------------------------------------------------------
// Bracelet Pipeline data layer
// Builds on hero data (Memorial_Bracelet__c) and adds pipeline-specific views.
// When SF_LIVE=true, heroes include inventory + design fields.
// When SF_LIVE=false (static JSON), we still show what we can.
// ---------------------------------------------------------------------------

/** @returns {Promise<object[]>} all bracelets with pipeline fields */
export async function getBracelets() {
  const heroes = await getHeroes();
  return heroes.map((h) => ({
    ...h,
    // Normalize design status for pipeline grouping
    designStage: normalizeDesignStatus(h.designStatus),
    hasInventory: (h.totalOnHand || 0) > 0,
    isLowStock: h.activeListing && (h.totalOnHand || 0) > 0 && (h.totalOnHand || 0) <= 5,
    isOutOfStock: h.activeListing && (h.totalOnHand || 0) === 0,
  }));
}

/** @returns {Promise<object>} pipeline stats for KPI blocks */
export async function getBraceletStats() {
  const bracelets = await getBracelets();
  const total = bracelets.length;
  const active = bracelets.filter((b) => b.activeListing).length;
  const withDesign = bracelets.filter((b) => b.designStatus).length;
  const hasSFData = withDesign > 0;

  // Inventory stats (only meaningful with SF live data)
  const totalInventory7in = bracelets.reduce((sum, b) => sum + (b.onHand7in || 0), 0);
  const totalInventory6in = bracelets.reduce((sum, b) => sum + (b.onHand6in || 0), 0);
  const totalInventory = bracelets.reduce((sum, b) => sum + (b.totalOnHand || 0), 0);
  const lowStock = bracelets.filter((b) => b.isLowStock).length;
  const outOfStock = bracelets.filter((b) => b.isOutOfStock).length;
  const totalDonations = bracelets.reduce((sum, b) => sum + (b.totalDonations || 0), 0);

  // Design pipeline counts
  const designCounts = {};
  for (const b of bracelets) {
    const stage = b.designStage || "Unknown";
    designCounts[stage] = (designCounts[stage] || 0) + 1;
  }

  // Branch distribution for active bracelets
  const activeBranchCounts = {};
  for (const b of bracelets.filter((b) => b.activeListing)) {
    const code = b.serviceCode || "Unknown";
    activeBranchCounts[code] = (activeBranchCounts[code] || 0) + 1;
  }

  return {
    total,
    active,
    hasSFData,
    totalInventory,
    totalInventory7in,
    totalInventory6in,
    lowStock,
    outOfStock,
    totalDonations,
    designCounts,
    activeBranchCounts,
  };
}

/** @returns {Promise<object[]>} bracelets grouped by design stage for pipeline view */
export async function getBraceletsByDesignStage() {
  const bracelets = await getBracelets();
  const stages = ["Draft", "Review", "Approved", "In Production", "Complete", "Unknown"];
  const grouped = {};
  for (const stage of stages) {
    grouped[stage] = [];
  }
  for (const b of bracelets) {
    const stage = b.designStage || "Unknown";
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(b);
  }
  return grouped;
}

/** @returns {Promise<object[]>} active bracelets with low or zero stock */
export async function getLowStockBracelets() {
  const bracelets = await getBracelets();
  return bracelets
    .filter((b) => b.activeListing && (b.isLowStock || b.isOutOfStock))
    .sort((a, b) => (a.totalOnHand || 0) - (b.totalOnHand || 0));
}

/** @returns {Promise<object[]>} inventory overview sorted by total on hand desc */
export async function getInventoryOverview() {
  const bracelets = await getBracelets();
  return bracelets
    .filter((b) => b.activeListing)
    .sort((a, b) => (b.totalOnHand || 0) - (a.totalOnHand || 0));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDesignStatus(status) {
  if (!status) return "Unknown";
  const s = status.toLowerCase().trim();
  if (s.includes("draft")) return "Draft";
  if (s.includes("review")) return "Review";
  if (s.includes("approved")) return "Approved";
  if (s.includes("production")) return "In Production";
  if (s.includes("complete") || s.includes("done") || s.includes("final")) return "Complete";
  if (s.includes("reject") || s.includes("block")) return "Blocked";
  return status; // pass through as-is
}

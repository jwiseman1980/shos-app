import { readFileSync } from "fs";
import { join } from "path";
import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Reconciliation Matrix
// Joins three data sources for every charity partner org:
//   1. Supabase: heroes + obligations (funds_donated, since rollups may lag)
//   2. Gmail receipts: data/donation-receipts.json grouped by org
//   3. Supabase: disbursements records grouped by org
//
// The matrix drives the /finance/recon page and the April reconciliation sessions.
// ---------------------------------------------------------------------------

// Load Gmail receipts from local JSON -- grouped by organization name
function loadReceiptsByOrg() {
  try {
    const filePath = join(process.cwd(), "data", "donation-receipts.json");
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    const byOrg = {};
    for (const r of raw) {
      const org = (r.organization || "Unknown").replace(/\s*\(manual PDF\)$/, "").trim();
      if (!byOrg[org]) byOrg[org] = [];
      byOrg[org].push({
        date: r.date,
        amount: r.amount,
        platform: r.platform,
        transactionId: r.transactionId,
        subject: r.subject,
        messageId: r.messageId,
      });
    }
    return byOrg;
  } catch {
    return {};
  }
}

// Normalize org names for fuzzy matching between Supabase and receipt JSON
function normalizeOrgName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/foundation|fund|memorial|inc\.?|llc\.?|the\s/gi, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Find best receipt match for an org name
function findReceiptsForOrg(orgName, receiptsByOrg) {
  if (receiptsByOrg[orgName]) return receiptsByOrg[orgName];

  const normOrg = normalizeOrgName(orgName);
  for (const [receiptOrg, receipts] of Object.entries(receiptsByOrg)) {
    if (normalizeOrgName(receiptOrg) === normOrg) return receipts;
    if (normOrg.length > 4 && normalizeOrgName(receiptOrg).includes(normOrg)) return receipts;
    if (normOrg.length > 4 && normOrg.includes(normalizeOrgName(receiptOrg))) return receipts;
  }
  return [];
}

/**
 * Build the full reconciliation matrix for all charity partner orgs.
 * Returns one row per org with: heroes, obligations, receipts, disbursements, status.
 */
export async function getReconMatrix() {
  try {
    const sb = getServerClient();

    // 1. All heroes with org linkage + per-hero obligation (funds_donated)
    const { data: heroes, error: heroErr } = await sb
      .from("heroes")
      .select(`
        id, sf_id, name, first_name, last_name, rank,
        memorial_month, memorial_day, funds_donated,
        organization_id,
        organization:organizations!organization_id(id, name)
      `)
      .not("organization_id", "is", null)
      .order("last_name", { ascending: true });

    if (heroErr) throw heroErr;

    // 2. All disbursement records with org linkage
    const { data: disbursements, error: disbErr } = await sb
      .from("disbursements")
      .select(`
        id, sf_id, name, amount, disbursement_date,
        organization_id, status, payment_method,
        organization:organizations!organization_id(id, name)
      `)
      .not("organization_id", "is", null)
      .order("disbursement_date", { ascending: true });

    if (disbErr) throw disbErr;

    // 3. Gmail receipts
    const receiptsByOrg = loadReceiptsByOrg();

    // Group heroes by org
    const orgMap = {};

    for (const h of (heroes || [])) {
      const orgId = h.organization_id;
      const orgName = h.organization?.name || orgId;

      if (!orgMap[orgId]) {
        orgMap[orgId] = {
          orgId,
          orgName,
          heroes: [],
          obligationGenerated: 0,
          disbursements: [],
          totalDisbursed: 0,
          receipts: [],
          receiptTotal: 0,
          receiptTotalKnown: 0,
          status: "unknown",
        };
      }

      orgMap[orgId].heroes.push({
        sfId: h.sf_id || h.id,
        name: h.name,
        rank: h.rank,
        memorialMonth: h.memorial_month,
        memorialDay: h.memorial_day,
        fundsGenerated: h.funds_donated || 0,
      });
      orgMap[orgId].obligationGenerated += h.funds_donated || 0;
    }

    // Add disbursements to orgs
    for (const d of (disbursements || [])) {
      const orgId = d.organization_id;
      if (!orgMap[orgId]) continue;
      orgMap[orgId].disbursements.push({
        sfId: d.sf_id || d.id,
        name: d.name,
        amount: d.amount || 0,
        date: d.disbursement_date,
        status: d.status,
        paymentMethod: d.payment_method,
      });
      orgMap[orgId].totalDisbursed += d.amount || 0;
    }

    // Match Gmail receipts to orgs
    for (const row of Object.values(orgMap)) {
      const matched = findReceiptsForOrg(row.orgName, receiptsByOrg);
      row.receipts = matched;
      row.receiptCount = matched.length;
      row.receiptTotal = matched.reduce((s, r) => s + (r.amount || 0), 0);
      row.receiptTotalKnown = matched.filter((r) => r.amount != null).length;
    }

    // Compute status for each org
    for (const row of Object.values(orgMap)) {
      const hasReceipts = row.receiptCount > 0;
      const hasDisbursements = row.disbursements.length > 0;
      const receiptsCovered = row.disbursements.length >= row.receiptCount;

      if (!hasReceipts && !hasDisbursements) {
        row.status = "no-activity";
      } else if (hasReceipts && !hasDisbursements) {
        row.status = "receipts-unmatched";
      } else if (!hasReceipts && hasDisbursements) {
        row.status = "sf-only";
      } else if (receiptsCovered) {
        row.status = "reconciled";
      } else {
        row.status = "partial";
      }
    }

    // Find receipt orgs with NO matching Supabase org
    const sbOrgNames = new Set(Object.values(orgMap).map((r) => normalizeOrgName(r.orgName)));
    const unmatchedReceiptOrgs = [];
    for (const receiptOrg of Object.keys(receiptsByOrg)) {
      if (receiptOrg === "Unknown") continue;
      const norm = normalizeOrgName(receiptOrg);
      const matched = [...sbOrgNames].some(
        (n) => n === norm || (n.length > 4 && n.includes(norm)) || (norm.length > 4 && norm.includes(n))
      );
      if (!matched) {
        unmatchedReceiptOrgs.push({
          orgName: receiptOrg,
          receipts: receiptsByOrg[receiptOrg],
          receiptCount: receiptsByOrg[receiptOrg].length,
          note: "In Gmail receipts but NOT found in Supabase as a linked org",
        });
      }
    }

    const rows = Object.values(orgMap).sort((a, b) => {
      const order = { "receipts-unmatched": 0, partial: 1, "sf-only": 2, reconciled: 3, "no-activity": 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5) || a.orgName.localeCompare(b.orgName);
    });

    const summary = {
      totalOrgs: rows.length,
      receiptsUnmatched: rows.filter((r) => r.status === "receipts-unmatched").length,
      partial: rows.filter((r) => r.status === "partial").length,
      sfOnly: rows.filter((r) => r.status === "sf-only").length,
      reconciled: rows.filter((r) => r.status === "reconciled").length,
      noActivity: rows.filter((r) => r.status === "no-activity").length,
      totalObligationGenerated: rows.reduce((s, r) => s + r.obligationGenerated, 0),
      totalDisbursed: rows.reduce((s, r) => s + r.totalDisbursed, 0),
      totalReceipts: rows.reduce((s, r) => s + r.receiptCount, 0),
      unmatchedReceiptOrgs,
    };

    return { rows, summary };
  } catch (err) {
    console.error("Recon matrix error:", err.message);
    return { rows: [], summary: {} };
  }
}

/**
 * Get recon detail for a single org by ID.
 */
export async function getReconOrgDetail(orgId) {
  const { rows } = await getReconMatrix();
  return rows.find((r) => r.orgId === orgId) || null;
}

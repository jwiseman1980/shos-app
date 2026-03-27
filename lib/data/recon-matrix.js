import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Reconciliation Matrix
// Joins three data sources for every charity partner org:
//   1. SF: heroes + obligations (Funds_Donated__c, since Account rollups are broken)
//   2. Gmail receipts: data/donation-receipts.json grouped by org
//   3. SF: Donation_Disbursement__c records grouped by org
//
// The matrix drives the /finance/recon page and the April reconciliation sessions.
// ---------------------------------------------------------------------------

const SF_LIVE = process.env.SF_LIVE === "true";

// Load Gmail receipts from local JSON — grouped by organization name
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

// Normalize org names for fuzzy matching between SF and receipt JSON
function normalizeOrgName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/foundation|fund|memorial|inc\.?|llc\.?|the\s/gi, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Find best receipt match for an SF org name
function findReceiptsForOrg(orgName, receiptsByOrg) {
  // Exact match first
  if (receiptsByOrg[orgName]) return receiptsByOrg[orgName];

  // Normalized fuzzy match
  const normOrg = normalizeOrgName(orgName);
  for (const [receiptOrg, receipts] of Object.entries(receiptsByOrg)) {
    if (normalizeOrgName(receiptOrg) === normOrg) return receipts;
    // Partial match — one name contains the other
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
  if (!SF_LIVE) return { rows: [], summary: {} };

  const { sfQuery } = await import("@/lib/salesforce");

  // 1. All heroes with org linkage + per-hero obligation (Funds_Donated__c)
  const heroes = await sfQuery(`
    SELECT Id, Name, First_Name__c, Last_Name__c, Rank__c,
           Memorial_Month__c, Memorial_Day__c, Funds_Donated__c,
           Associated_Organization__c, Associated_Organization__r.Name
    FROM Memorial_Bracelet__c
    WHERE Associated_Organization__c != null
    ORDER BY Associated_Organization__r.Name, Last_Name__c
  `);

  // 2. All disbursement records with org linkage
  const disbursements = await sfQuery(`
    SELECT Id, Name, Amount__c, Disbursement_Date__c,
           Account__c, Account__r.Name,
           Status__c, Payment_Method__c
    FROM Donation_Disbursement__c
    WHERE Account__c != null
    ORDER BY Account__r.Name, Disbursement_Date__c
  `);

  // 3. Gmail receipts
  const receiptsByOrg = loadReceiptsByOrg();

  // Group heroes by org
  const orgMap = {};

  for (const h of heroes) {
    const orgId = h.Associated_Organization__c;
    const orgName = h.Associated_Organization__r?.Name || orgId;

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
      sfId: h.Id,
      name: h.Name,
      rank: h.Rank__c,
      memorialMonth: h.Memorial_Month__c,
      memorialDay: h.Memorial_Day__c,
      fundsGenerated: h.Funds_Donated__c || 0,
    });
    orgMap[orgId].obligationGenerated += h.Funds_Donated__c || 0;
  }

  // Add disbursements to orgs
  for (const d of disbursements) {
    const orgId = d.Account__c;
    if (!orgMap[orgId]) continue;
    orgMap[orgId].disbursements.push({
      sfId: d.Id,
      name: d.Name,
      amount: d.Amount__c || 0,
      date: d.Disbursement_Date__c,
      status: d.Status__c,
      paymentMethod: d.Payment_Method__c,
    });
    orgMap[orgId].totalDisbursed += d.Amount__c || 0;
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
      row.status = "no-activity";  // No receipts, no disbursements in SF
    } else if (hasReceipts && !hasDisbursements) {
      row.status = "receipts-unmatched";  // Receipts found, nothing in SF
    } else if (!hasReceipts && hasDisbursements) {
      row.status = "sf-only";  // SF records exist, no Gmail receipts found
    } else if (receiptsCovered) {
      row.status = "reconciled";  // SF records >= receipts found
    } else {
      row.status = "partial";  // Some receipts matched, some not
    }
  }

  // Find receipt orgs with NO matching SF org (orgs in Gmail not in SF)
  const sfOrgNames = new Set(Object.values(orgMap).map((r) => normalizeOrgName(r.orgName)));
  const unmatchedReceiptOrgs = [];
  for (const receiptOrg of Object.keys(receiptsByOrg)) {
    if (receiptOrg === "Unknown") continue;
    const norm = normalizeOrgName(receiptOrg);
    const matched = [...sfOrgNames].some(
      (n) => n === norm || (n.length > 4 && n.includes(norm)) || (norm.length > 4 && norm.includes(n))
    );
    if (!matched) {
      unmatchedReceiptOrgs.push({
        orgName: receiptOrg,
        receipts: receiptsByOrg[receiptOrg],
        receiptCount: receiptsByOrg[receiptOrg].length,
        note: "In Gmail receipts but NOT found in Salesforce as a linked org",
      });
    }
  }

  const rows = Object.values(orgMap).sort((a, b) => {
    // Sort: receipts-unmatched first, then partial, then sf-only, then reconciled, then no-activity
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
}

/**
 * Get recon detail for a single org by SF Account ID.
 */
export async function getReconOrgDetail(orgId) {
  const { rows } = await getReconMatrix();
  return rows.find((r) => r.orgId === orgId) || null;
}

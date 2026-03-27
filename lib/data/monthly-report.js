import { getOrdersByMonth, getDonatedOrdersByMonth } from "./orders";
import { getDonationsByMonth } from "./donations";
import { getDisbursementsByMonth } from "./disbursements";
import { getExpensesByMonth } from "./expenses";
import { getOrgBalances } from "./obligations";
import { getMonthName } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Monthly Financial Report Assembly
// Combines all data sources into the 8-section report structure.
// ---------------------------------------------------------------------------

/**
 * Assemble the full monthly financial report for a given month/year.
 * This replaces the manual 8-sheet Excel workbook (SOP-FIN-002).
 *
 * @param {number} month — 1-12
 * @param {number} year — e.g. 2026
 * @returns {Promise<object>} — full report with all 8 sections
 */
export async function assembleMonthlyReport(month, year) {
  // Fetch all data in parallel
  const [
    braceletSales,
    donationsReceived,
    disbursements,
    donatedBracelets,
    expenses,
    orgBalances,
  ] = await Promise.all([
    getOrdersByMonth(month, year),
    getDonationsByMonth(month, year),
    getDisbursementsByMonth(month, year),
    getDonatedOrdersByMonth(month, year),
    getExpensesByMonth(month, year),
    getOrgBalances(),
  ]);

  // ── Sheet 2: Bracelet Sales ──
  // allBracelets: every bracelet sold (includes bulk/wholesale at non-standard prices)
  // obligationBracelets: only $35/$45 items that generate a $10 charity obligation
  const allBracelets = braceletSales.filter((s) => s.isBracelet);
  const obligationBracelets = braceletSales.filter((s) => s.generatesObligation);
  const salesRevenue = braceletSales.reduce((s, r) => s + r.lineTotal, 0);
  const braceletUnits = allBracelets.reduce((s, r) => s + r.quantity, 0);
  const obligationUnits = obligationBracelets.reduce((s, r) => s + r.quantity, 0);
  const newObligations = obligationBracelets.reduce((s, r) => s + r.obligationAmount, 0);
  const shDonations = obligationBracelets.reduce((s, r) => s + r.shDonation, 0);

  // ── Sheet 3: Donations Received ──
  const donationsTotal = donationsReceived.reduce((s, d) => s + d.amount, 0);

  // ── Sheet 4: Disbursements ──
  const disbursementsTotal = disbursements.reduce((s, d) => s + d.amount, 0);

  // ── Sheet 5: Donated Bracelets ──
  const donatedCount = donatedBracelets.reduce((s, d) => s + d.quantity, 0);
  const donatedCost = donatedBracelets.reduce((s, d) => s + d.totalCost, 0);

  // ── Sheet 6: Other Expenses ──
  const activeExpenses = expenses.filter((e) => !e.isExcluded);
  const expensesTotal = activeExpenses.reduce((s, e) => s + e.amount, 0);
  const expensesByCategory = {};
  for (const e of activeExpenses) {
    const cat = e.category || "Other / Miscellaneous";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + e.amount;
  }

  // ── Sheet 7: Obligation Tracker ──
  // Calculate per-org: opening balance + new obligations - disbursements = closing balance
  const obligationsByOrg = {};
  for (const org of orgBalances) {
    obligationsByOrg[org.orgId] = {
      orgName: org.orgName,
      openingBalance: org.outstanding,
      newObligations: 0,
      disbursementsThisMonth: 0,
    };
  }
  // Add new obligations from this month's sales (only obligation-generating items)
  for (const sale of obligationBracelets) {
    if (sale.designatedOrgId && sale.obligationAmount > 0) {
      if (!obligationsByOrg[sale.designatedOrgId]) {
        obligationsByOrg[sale.designatedOrgId] = {
          orgName: sale.designatedOrg,
          openingBalance: 0,
          newObligations: 0,
          disbursementsThisMonth: 0,
        };
      }
      obligationsByOrg[sale.designatedOrgId].newObligations += sale.obligationAmount;
    }
  }
  // Subtract disbursements
  for (const d of disbursements) {
    if (d.organizationId && obligationsByOrg[d.organizationId]) {
      obligationsByOrg[d.organizationId].disbursementsThisMonth += d.amount;
    }
  }
  // Calculate closing balances
  const obligationTracker = Object.entries(obligationsByOrg)
    .map(([orgId, data]) => ({
      orgId,
      orgName: data.orgName,
      openingBalance: data.openingBalance,
      newObligations: data.newObligations,
      disbursements: data.disbursementsThisMonth,
      closingBalance: data.openingBalance + data.newObligations - data.disbursementsThisMonth,
    }))
    .filter((o) => o.openingBalance > 0 || o.newObligations > 0 || o.disbursements > 0)
    .sort((a, b) => b.closingBalance - a.closingBalance);

  const totalOpeningBalance = obligationTracker.reduce((s, o) => s + o.openingBalance, 0);
  const totalClosingBalance = obligationTracker.reduce((s, o) => s + o.closingBalance, 0);

  // ── Sheet 8: Data Issues ──
  const dataIssues = detectDataIssues(braceletSales, disbursements, orgBalances);

  // ── Sheet 1: Summary Dashboard ──
  const totalMoneyIn = salesRevenue + donationsTotal;
  const totalMoneyOut = disbursementsTotal + donatedCost + expensesTotal;

  const summary = {
    period: `${getMonthName(month)} ${year}`,
    month,
    year,
    moneyIn: {
      braceletSales: salesRevenue,
      donationsReceived: donationsTotal,
      total: totalMoneyIn,
    },
    moneyOut: {
      disbursements: disbursementsTotal,
      donatedBraceletCosts: donatedCost,
      operationalExpenses: expensesTotal,
      total: totalMoneyOut,
    },
    net: totalMoneyIn - totalMoneyOut,
    obligations: {
      newThisMonth: newObligations,
      fulfilledThisMonth: disbursementsTotal,
      closingBalance: totalClosingBalance,
    },
    keyMetrics: {
      braceletsSold: braceletUnits,
      obligationBracelets: obligationUnits,
      braceletsDonated: donatedCount,
      orgsSupported: disbursements.length,
      shFundDonations: shDonations,
    },
  };

  return {
    summary,
    braceletSales,
    donationsReceived,
    disbursements,
    donatedBracelets,
    expenses: activeExpenses,
    expensesByCategory,
    obligationTracker,
    obligationTotals: {
      openingBalance: totalOpeningBalance,
      newObligations,
      disbursements: disbursementsTotal,
      closingBalance: totalClosingBalance,
    },
    dataIssues,
  };
}

// ---------------------------------------------------------------------------
// Data Issue Detection (Sheet 8)
// ---------------------------------------------------------------------------

function detectDataIssues(braceletSales, disbursements, orgBalances) {
  const issues = [];

  // Check for sales without designated org
  const noOrg = braceletSales.filter((s) => s.generatesObligation && !s.designatedOrgId);
  if (noOrg.length > 0) {
    issues.push({
      type: "missing_org",
      severity: "warning",
      count: noOrg.length,
      description: `${noOrg.length} bracelet sales have no designated organization`,
      details: noOrg.slice(0, 10).map((s) => `${s.sku} (${s.heroName})`),
    });
  }

  // Check for missing receipts on disbursements
  const noReceipt = disbursements.filter((d) => !d.receiptCaptured);
  if (noReceipt.length > 0) {
    issues.push({
      type: "missing_receipt",
      severity: "warning",
      count: noReceipt.length,
      description: `${noReceipt.length} disbursements missing receipts`,
      details: noReceipt.map((d) => `${d.name} — ${d.organizationName || "Unknown org"}`),
    });
  }

  // Check for stale obligations (org outstanding > $100 for 3+ months without disbursement)
  const staleOrgs = orgBalances.filter((o) => o.outstanding > 100 && o.disbursed2026 === 0);
  if (staleOrgs.length > 0) {
    issues.push({
      type: "stale_obligation",
      severity: "info",
      count: staleOrgs.length,
      description: `${staleOrgs.length} organizations with >$100 outstanding and no 2026 disbursements`,
      details: staleOrgs.slice(0, 10).map((o) => `${o.orgName}: $${o.outstanding}`),
    });
  }

  // Check for non-bracelet items in sales (could be merch — informational)
  const nonBracelet = braceletSales.filter((s) => !s.isBracelet);
  if (nonBracelet.length > 0) {
    issues.push({
      type: "non_bracelet",
      severity: "info",
      count: nonBracelet.length,
      description: `${nonBracelet.length} non-bracelet items in order data (no obligation generated)`,
      details: nonBracelet.slice(0, 5).map((s) => `${s.sku} — $${s.unitPrice}`),
    });
  }

  return issues;
}

import { getCurrentYear } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Data source: Donation_Disbursement__c in Salesforce (SF_LIVE=true) or empty fallback.
// ---------------------------------------------------------------------------

const SF_LIVE = process.env.SF_LIVE === "true";

// Try Account__c first (SOP spec), fallback to Organization__c (dossier naming)
const FIELDS_ACCOUNT = `
  Id, Name, Account__c, Account__r.Name,
  Amount__c, Disbursement_Date__c, Fund_Type__c,
  Cycle_Month__c, Cycle_Year__c, Payment_Method__c,
  Confirmation_Number__c, Gmail_Message_Id__c,
  Receipt_Captured__c, CreatedDate
`.trim();

const FIELDS_ORG = `
  Id, Name, Organization__c, Organization__r.Name,
  Amount__c, Disbursement_Date__c, Fund_Type__c,
  Cycle_Month__c, Cycle_Year__c, Payment_Method__c,
  Confirmation_Number__c, Gmail_Message_Id__c,
  Receipt_Captured__c, CreatedDate
`.trim();

async function fetchDisbursementsFromSF() {
  const { sfQuery, sfDescribe } = await import("@/lib/salesforce");

  // Discover actual field names via describe — field names in docs may not match SF
  let fieldMap = {};
  try {
    const desc = await sfDescribe("Donation_Disbursement__c");
    const fieldNames = new Set(desc.fields.map((f) => f.name));

    // Map expected fields to actual names (check common variants)
    const find = (...candidates) => candidates.find((c) => fieldNames.has(c)) || null;
    fieldMap = {
      org: find("Account__c", "Organization__c"),
      amount: find("Amount__c"),
      date: find("Disbursement_Date__c", "Date__c"),
      fundType: find("Fund_Type__c", "Disbursement_Type__c"),
      cycleMonth: find("Cycle_Month__c", "Report_Month__c"),
      cycleYear: find("Cycle_Year__c"),
      paymentMethod: find("Payment_Method__c"),
      confirmation: find("Confirmation_Number__c"),
      gmail: find("Gmail_Message_Id__c"),
      receipt: find("Receipt_Captured__c"),
    };
  } catch (descErr) {
    console.error("Describe Donation_Disbursement__c failed:", descErr.message);
    return [];
  }

  // Build SELECT clause from discovered fields
  const cols = ["Id", "Name", "CreatedDate"];
  for (const [, field] of Object.entries(fieldMap)) {
    if (field) cols.push(field);
  }
  // Add relationship name for org lookup
  const orgRel = fieldMap.org
    ? fieldMap.org.replace("__c", "__r") + ".Name"
    : null;
  if (orgRel) cols.push(orgRel);

  const records = await sfQuery(`
    SELECT ${cols.join(", ")}
    FROM Donation_Disbursement__c
    ORDER BY ${fieldMap.date || "CreatedDate"} DESC NULLS LAST
  `.trim());

  const orgRelKey = fieldMap.org ? fieldMap.org.replace("__c", "__r") : null;

  return records.map((r) => ({
    sfId: r.Id,
    name: r.Name,
    organizationId: fieldMap.org ? (r[fieldMap.org] || null) : null,
    organizationName: orgRelKey ? (r[orgRelKey]?.Name || null) : null,
    amount: fieldMap.amount ? (r[fieldMap.amount] || 0) : 0,
    disbursementDate: fieldMap.date ? (r[fieldMap.date] || null) : null,
    fundType: fieldMap.fundType ? (r[fieldMap.fundType] || null) : null,
    cycleMonth: fieldMap.cycleMonth ? (r[fieldMap.cycleMonth] != null ? Number(r[fieldMap.cycleMonth]) : null) : null,
    cycleYear: fieldMap.cycleYear ? (r[fieldMap.cycleYear] != null ? Number(r[fieldMap.cycleYear]) : null) : null,
    paymentMethod: fieldMap.paymentMethod ? (r[fieldMap.paymentMethod] || null) : null,
    confirmationNumber: fieldMap.confirmation ? (r[fieldMap.confirmation] || null) : null,
    gmailMessageId: fieldMap.gmail ? (r[fieldMap.gmail] || null) : null,
    receiptCaptured: fieldMap.receipt ? (r[fieldMap.receipt] || false) : false,
    createdDate: r.CreatedDate,
  }));
}

async function loadDisbursements() {
  if (SF_LIVE) {
    try {
      return await fetchDisbursementsFromSF();
    } catch (err) {
      console.error("Disbursement query failed:", err.message);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** @returns {Promise<object[]>} all disbursements, most recent first */
export async function getDisbursements() {
  return loadDisbursements();
}

/** @returns {Promise<object[]>} disbursements for a specific cycle month/year */
export async function getDisbursementsByMonth(month, year) {
  const all = await loadDisbursements();
  return all.filter(
    (d) => d.cycleMonth === Number(month) && d.cycleYear === Number(year)
  );
}

/**
 * Get disbursements due for a given cycle month/year.
 * Disbursements for month M are triggered by heroes with anniversaries in month M-1.
 * Returns each org with: heroes who triggered it, outstanding balance, amount already
 * sent this cycle, and contact info for payment.
 */
export async function getDisbursementsDue(month, year) {
  if (!SF_LIVE) return [];

  try {
    const { getAnniversaryObligations } = await import("@/lib/data/obligations");
    const { getOrgBalances } = await import("@/lib/data/obligations");

    // Anniversary month = prior month (disbursements for M are triggered by M-1 anniversaries)
    const anniversaryMonth = month === 1 ? 12 : month - 1;
    const anniversaryYear = month === 1 ? year - 1 : year;

    const [annivData, orgBalances, alreadySent] = await Promise.all([
      getAnniversaryObligations(anniversaryMonth, anniversaryYear),
      getOrgBalances(),
      getDisbursementsByMonth(month, year),
    ]);

    const balanceMap = {};
    for (const b of orgBalances) balanceMap[b.orgId] = b;

    const sentByOrg = {};
    for (const d of alreadySent) {
      if (d.organizationId) {
        if (!sentByOrg[d.organizationId]) sentByOrg[d.organizationId] = [];
        sentByOrg[d.organizationId].push(d);
      }
    }

    const dueList = [];
    for (const [orgId, orgData] of Object.entries(annivData.byOrg)) {
      const balance = balanceMap[orgId];
      const sent = sentByOrg[orgId] || [];
      const amountSent = sent.reduce((s, d) => s + d.amount, 0);
      const outstanding = balance?.outstanding || 0;

      dueList.push({
        orgId,
        orgName: balance?.orgName || orgId,
        heroes: orgData.heroes || [],
        heroCount: orgData.heroCount || 0,
        newObligations: orgData.totalObligation || 0,
        outstandingBalance: outstanding,
        amountSent,
        amountDue: Math.max(0, outstanding - amountSent),
        status: outstanding === 0 ? "zero-balance"
          : amountSent >= outstanding ? "complete"
          : amountSent > 0 ? "partial"
          : "due",
        sentRecords: sent,
        website: balance?.website || null,
        phone: balance?.phone || null,
        email: balance?.email || null,
        billingCity: balance?.billingCity || null,
        billingState: balance?.billingState || null,
      });
    }

    return dueList.sort((a, b) => b.amountDue - a.amountDue);
  } catch (err) {
    console.error("getDisbursementsDue error:", err.message);
    return [];
  }
}

/** @returns {Promise<object[]>} disbursements for a specific organization */
export async function getDisbursementsByOrg(accountId) {
  if (!accountId) return [];
  const all = await loadDisbursements();
  return all.filter((d) => d.organizationId === accountId);
}

/** @returns {Promise<object>} aggregate disbursement stats */
export async function getDisbursementStats() {
  const all = await loadDisbursements();
  const year = getCurrentYear();

  const totalDisbursed = all.reduce((sum, d) => sum + d.amount, 0);
  const thisYear = all.filter((d) => d.cycleYear === year);
  const totalThisYear = thisYear.reduce((sum, d) => sum + d.amount, 0);

  // Group by month for trend
  const byMonth = {};
  for (const d of thisYear) {
    const key = `${d.cycleYear}-${String(d.cycleMonth).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + d.amount;
  }

  const totalCount = all.length;
  const receiptCount = all.filter((d) => d.receiptCaptured).length;

  return {
    totalDisbursed,
    totalThisYear,
    byMonth,
    totalCount,
    receiptCount,
    receiptComplianceRate:
      totalCount > 0 ? Math.round((receiptCount / totalCount) * 100) : 100,
  };
}

/** Create a new Donation_Disbursement__c record */
export async function createDisbursement(data) {
  if (!SF_LIVE) return { success: false, error: "SF_LIVE is not enabled" };

  try {
    const { sfCreate } = await import("@/lib/salesforce");
    const result = await sfCreate("Donation_Disbursement__c", {
      Organization__c: data.organizationId,
      Amount__c: data.amount,
      Disbursement_Date__c: data.disbursementDate,
      Fund_Type__c: data.fundType || "Restricted",
      Cycle_Month__c: data.cycleMonth,
      Cycle_Year__c: data.cycleYear,
      Payment_Method__c: data.paymentMethod || null,
      Confirmation_Number__c: data.confirmationNumber || null,
      Gmail_Message_Id__c: data.gmailMessageId || null,
      Receipt_Captured__c: data.receiptCaptured || false,
    });
    return { success: true, id: result.id };
  } catch (err) {
    console.error("Create disbursement error:", err.message);
    return { success: false, error: err.message };
  }
}

/** Update an existing Donation_Disbursement__c record */
export async function updateDisbursement(id, data) {
  if (!SF_LIVE) return { success: false, error: "SF_LIVE is not enabled" };

  try {
    const { sfUpdate } = await import("@/lib/salesforce");
    const fields = {};
    if (data.amount !== undefined) fields.Amount__c = data.amount;
    if (data.disbursementDate !== undefined) fields.Disbursement_Date__c = data.disbursementDate;
    if (data.fundType !== undefined) fields.Fund_Type__c = data.fundType;
    if (data.cycleMonth !== undefined) fields.Cycle_Month__c = data.cycleMonth;
    if (data.cycleYear !== undefined) fields.Cycle_Year__c = data.cycleYear;
    if (data.organizationId !== undefined) fields.Account__c = data.organizationId;
    if (data.paymentMethod !== undefined) fields.Payment_Method__c = data.paymentMethod;
    if (data.confirmationNumber !== undefined) fields.Confirmation_Number__c = data.confirmationNumber;
    if (data.gmailMessageId !== undefined) fields.Gmail_Message_Id__c = data.gmailMessageId;
    if (data.receiptCaptured !== undefined) fields.Receipt_Captured__c = data.receiptCaptured;

    await sfUpdate("Donation_Disbursement__c", id, fields);
    return { success: true };
  } catch (err) {
    console.error("Update disbursement error:", err.message);
    return { success: false, error: err.message };
  }
}

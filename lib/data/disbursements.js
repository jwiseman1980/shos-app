import { getCurrentYear } from "@/lib/dates";
import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Data source: disbursements table in Supabase
// ---------------------------------------------------------------------------

async function fetchDisbursementsFromSupabase() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("disbursements")
    .select(`
      *,
      organization:organizations!organization_id(id, name)
    `)
    .order("disbursement_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Supabase disbursements query failed: ${error.message}`);

  return (data || []).map((r) => ({
    sfId: r.sf_id || r.id,
    id: r.id,
    name: r.name,
    organizationId: r.organization_id || null,
    organizationName: r.organization?.name || null,
    amount: r.amount || 0,
    disbursementDate: r.disbursement_date || null,
    fundType: r.fund_type || null,
    cycleMonth: r.cycle_month != null ? Number(r.cycle_month) : null,
    cycleYear: r.cycle_year != null ? Number(r.cycle_year) : null,
    paymentMethod: r.payment_method || null,
    confirmationNumber: r.confirmation_number || null,
    gmailMessageId: r.gmail_message_id || null,
    receiptCaptured: r.receipt_captured || false,
    createdDate: r.created_at,
  }));
}

async function loadDisbursements() {
  try {
    return await fetchDisbursementsFromSupabase();
  } catch (err) {
    console.error("Disbursement query failed:", err.message);
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
 */
export async function getDisbursementsDue(month, year) {
  try {
    const { getAnniversaryObligations } = await import("@/lib/data/obligations");
    const { getOrgBalances } = await import("@/lib/data/obligations");

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

/** Create a new disbursement record in Supabase */
export async function createDisbursement(data) {
  try {
    const sb = getServerClient();
    const { data: result, error } = await sb
      .from("disbursements")
      .insert({
        organization_id: data.organizationId,
        amount: data.amount,
        disbursement_date: data.disbursementDate,
        fund_type: data.fundType || "Restricted",
        cycle_month: data.cycleMonth,
        cycle_year: data.cycleYear,
        payment_method: data.paymentMethod || null,
        confirmation_number: data.confirmationNumber || null,
        gmail_message_id: data.gmailMessageId || null,
        receipt_captured: data.receiptCaptured || false,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, id: result.id };
  } catch (err) {
    console.error("Create disbursement error:", err.message);
    return { success: false, error: err.message };
  }
}

/** Update an existing disbursement record in Supabase */
export async function updateDisbursement(id, data) {
  try {
    const sb = getServerClient();
    const fields = {};
    if (data.amount !== undefined) fields.amount = data.amount;
    if (data.disbursementDate !== undefined) fields.disbursement_date = data.disbursementDate;
    if (data.fundType !== undefined) fields.fund_type = data.fundType;
    if (data.cycleMonth !== undefined) fields.cycle_month = data.cycleMonth;
    if (data.cycleYear !== undefined) fields.cycle_year = data.cycleYear;
    if (data.organizationId !== undefined) fields.organization_id = data.organizationId;
    if (data.paymentMethod !== undefined) fields.payment_method = data.paymentMethod;
    if (data.confirmationNumber !== undefined) fields.confirmation_number = data.confirmationNumber;
    if (data.gmailMessageId !== undefined) fields.gmail_message_id = data.gmailMessageId;
    if (data.receiptCaptured !== undefined) fields.receipt_captured = data.receiptCaptured;

    const { error } = await sb
      .from("disbursements")
      .update(fields)
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("Update disbursement error:", err.message);
    return { success: false, error: err.message };
  }
}

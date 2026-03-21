import { getCurrentMonth, getCurrentYear } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Data source: Donation__c in Salesforce (SF_LIVE=true) or empty fallback.
// ---------------------------------------------------------------------------

const useSalesforce = process.env.SF_LIVE === "true";

/**
 * Fetch all donations from Salesforce.
 */
async function fetchDonationsFromSF() {
  const { sfQuery } = await import("@/lib/salesforce");

  const soql = `
    SELECT
      Id,
      Name,
      Donor_First_Name__c,
      Donor_Last_Name__c,
      Donor_Email__c,
      Email__c,
      Billing_Name__c,
      Donation_Amount__c,
      Donation_Date__c,
      Paid_at__c,
      Created_at__c,
      CreatedDate,
      Source__c,
      Origin__c,
      Payment_Method__c,
      Order_ID__c,
      Amount_Refunded__c
    FROM Donation__c
    ORDER BY Donation_Date__c DESC NULLS LAST
  `.trim();

  const records = await sfQuery(soql);

  return records.map((r) => ({
    sfId: r.Id,
    name: r.Name,
    donorName:
      r.Billing_Name__c ||
      [r.Donor_First_Name__c, r.Donor_Last_Name__c].filter(Boolean).join(" ") ||
      null,
    donorFirstName: r.Donor_First_Name__c || null,
    donorLastName: r.Donor_Last_Name__c || null,
    donorEmail: r.Donor_Email__c || r.Email__c || null,
    amount: r.Donation_Amount__c || 0,
    donationDate: r.Donation_Date__c || r.Paid_at__c || r.Created_at__c || r.CreatedDate,
    source: r.Source__c || null,
    origin: r.Origin__c || null,
    paymentMethod: r.Payment_Method__c || null,
    orderId: r.Order_ID__c || null,
    amountRefunded: r.Amount_Refunded__c || 0,
  }));
}

/**
 * Internal helper — returns all donations.
 */
async function loadDonations() {
  if (useSalesforce) {
    try {
      return await fetchDonationsFromSF();
    } catch (err) {
      console.error("Salesforce donation query failed:", err.message);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** @returns {Promise<object[]>} all donations, most recent first */
export async function getDonations() {
  return loadDonations();
}

/** @returns {Promise<object[]>} donations from the current month */
export async function getDonationsThisMonth() {
  const donations = await loadDonations();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  return donations.filter((d) => {
    if (!d.donationDate) return false;
    const dt = new Date(d.donationDate);
    return dt.getMonth() + 1 === month && dt.getFullYear() === year;
  });
}

/** @returns {Promise<object[]>} donations from a specific month/year */
export async function getDonationsByMonth(month, year) {
  const donations = await loadDonations();
  return donations.filter((d) => {
    if (!d.donationDate) return false;
    const dt = new Date(d.donationDate);
    return dt.getMonth() + 1 === month && dt.getFullYear() === year;
  });
}

/** @returns {Promise<object>} aggregate donation stats */
export async function getDonationStats() {
  const donations = await loadDonations();
  const total = donations.length;
  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const withEmail = donations.filter((d) => d.donorEmail).length;
  const avgAmount = total > 0 ? totalAmount / total : 0;

  // This month
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const thisMonth = donations.filter((d) => {
    if (!d.donationDate) return false;
    const dt = new Date(d.donationDate);
    return dt.getMonth() + 1 === month && dt.getFullYear() === year;
  });
  const thisMonthTotal = thisMonth.reduce((sum, d) => sum + d.amount, 0);

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = donations.filter((d) => {
    if (!d.donationDate) return false;
    return new Date(d.donationDate) >= thirtyDaysAgo;
  });

  return {
    total,
    totalAmount,
    avgAmount,
    withEmail,
    thisMonthCount: thisMonth.length,
    thisMonthTotal,
    recentCount: recent.length,
    recentTotal: recent.reduce((sum, d) => sum + d.amount, 0),
  };
}

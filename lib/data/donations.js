import { getCurrentMonth, getCurrentYear } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Data source: Donation__c in Salesforce (SF_LIVE=true) or empty fallback.
// ---------------------------------------------------------------------------

const useSalesforce = process.env.SF_LIVE === "true";

// Base fields that always exist on Donation__c
const BASE_FIELDS = `
  Id, Name, Donor_First_Name__c, Donor_Last_Name__c,
  Donor_Email__c, Email__c, Billing_Name__c,
  Donation_Amount__c, Donation_Date__c, Paid_at__c,
  Created_at__c, CreatedDate, Source__c, Origin__c,
  Payment_Method__c, Order_ID__c, Amount_Refunded__c
`.trim();

// Stewardship fields — may not exist yet in SF (added as part of donor engagement build-out)
const STEWARDSHIP_FIELDS = `
  Thank_You_Sent__c, Thank_You_Date__c, Thank_You_By__c,
  Donor_Contact__c, Donor_Segment__c, Campaign__c,
  Impact_Update_Sent__c, Impact_Update_Date__c
`.trim();

/**
 * Fetch all donations from Salesforce.
 * Tries full query with stewardship fields first; falls back to base fields
 * if the new fields haven't been created in SF yet.
 */
async function fetchDonationsFromSF() {
  const { sfQuery } = await import("@/lib/salesforce");

  let records;
  try {
    const fullSoql = `
      SELECT ${BASE_FIELDS}, ${STEWARDSHIP_FIELDS}
      FROM Donation__c
      ORDER BY Donation_Date__c DESC NULLS LAST
    `.trim();
    records = await sfQuery(fullSoql);
  } catch (fullErr) {
    // Stewardship fields likely don't exist yet — fall back to base query
    console.warn("Stewardship fields not yet in SF, using base query:", fullErr.message?.slice(0, 120));
    const baseSoql = `
      SELECT ${BASE_FIELDS}
      FROM Donation__c
      ORDER BY Donation_Date__c DESC NULLS LAST
    `.trim();
    records = await sfQuery(baseSoql);
  }

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
    // Stewardship fields
    thankYouSent: r.Thank_You_Sent__c || false,
    thankYouDate: r.Thank_You_Date__c || null,
    thankYouBy: r.Thank_You_By__c || null,
    donorContactId: r.Donor_Contact__c || null,
    donorSegment: r.Donor_Segment__c || null,
    campaign: r.Campaign__c || null,
    impactUpdateSent: r.Impact_Update_Sent__c || false,
    impactUpdateDate: r.Impact_Update_Date__c || null,
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

  // Thank-you stats (from SF data)
  const thankedCount = donations.filter((d) => d.thankYouSent).length;
  const needsThankCount = donations.filter(
    (d) => d.donorEmail && !d.thankYouSent
  ).length;

  return {
    total,
    totalAmount,
    avgAmount,
    withEmail,
    thisMonthCount: thisMonth.length,
    thisMonthTotal,
    recentCount: recent.length,
    recentTotal: recent.reduce((sum, d) => sum + d.amount, 0),
    thankedCount,
    needsThankCount,
  };
}

/** @returns {Promise<object[]>} donations for a specific donor email */
export async function getDonationsByEmail(email) {
  if (!email) return [];
  const donations = await loadDonations();
  return donations.filter(
    (d) => d.donorEmail && d.donorEmail.toLowerCase() === email.toLowerCase()
  );
}

/** @returns {Promise<object[]>} donations due for Day 30 impact update */
export async function getDonationsNeedingImpactUpdate() {
  const donations = await loadDonations();
  const now = new Date();
  return donations.filter((d) => {
    if (!d.thankYouSent || d.impactUpdateSent || !d.donorEmail) return false;
    if (!d.donationDate) return false;
    const daysSince = Math.floor(
      (now - new Date(d.donationDate)) / (1000 * 60 * 60 * 24)
    );
    return daysSince >= 25 && daysSince <= 45;
  });
}

/**
 * Compute donor retention stats from donation data.
 * @returns {Promise<object>} retention metrics
 */
export async function getDonorRetentionStats() {
  const donations = await loadDonations();
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  // Group by email
  const byEmail = {};
  for (const d of donations) {
    const key = d.donorEmail || d.sfId;
    if (!byEmail[key]) byEmail[key] = [];
    byEmail[key].push(d);
  }

  const donors = Object.entries(byEmail);
  let lapsedDonors = [];
  let retainedCount = 0;
  let eligibleForRetention = 0;
  let newThisMonth = 0;

  const month = getCurrentMonth();
  const year = getCurrentYear();

  for (const [key, dons] of donors) {
    const sorted = dons.sort(
      (a, b) => new Date(b.donationDate) - new Date(a.donationDate)
    );
    const lastDate = new Date(sorted[0].donationDate);
    const firstDate = new Date(sorted[sorted.length - 1].donationDate);

    // New this month
    if (
      sorted.length === 1 &&
      firstDate.getMonth() + 1 === month &&
      firstDate.getFullYear() === year
    ) {
      newThisMonth++;
    }

    // Retention: had a donation > 12 months ago AND also donated in last 12 months
    if (firstDate < twelveMonthsAgo) {
      eligibleForRetention++;
      if (lastDate > twelveMonthsAgo) retainedCount++;
    }

    // Lapsed: 2+ donations, but last one > 6 months ago
    if (sorted.length >= 2 && lastDate < sixMonthsAgo) {
      lapsedDonors.push({
        email: sorted[0].donorEmail,
        name: sorted[0].donorName,
        count: sorted.length,
        totalAmount: sorted.reduce((s, d) => s + d.amount, 0),
        lastDate: sorted[0].donationDate,
        daysSinceLast: Math.floor(
          (now - lastDate) / (1000 * 60 * 60 * 24)
        ),
      });
    }
  }

  lapsedDonors.sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    totalUniqueDonors: donors.length,
    retentionRate:
      eligibleForRetention > 0
        ? Math.round((retainedCount / eligibleForRetention) * 100)
        : null,
    retainedCount,
    eligibleForRetention,
    lapsedDonors,
    newThisMonth,
  };
}

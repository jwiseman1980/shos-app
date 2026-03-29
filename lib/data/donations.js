import { getCurrentMonth, getCurrentYear } from "@/lib/dates";
import { getServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Data source: donations table in Supabase
// ---------------------------------------------------------------------------

async function fetchDonationsFromSupabase() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("donations")
    .select("*")
    .order("donation_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Supabase donations query failed: ${error.message}`);

  return (data || []).map((r) => ({
    sfId: r.sf_id || r.id,
    id: r.id,
    name: r.name,
    donorName:
      r.billing_name ||
      [r.donor_first_name, r.donor_last_name].filter(Boolean).join(" ") ||
      null,
    donorFirstName: r.donor_first_name || null,
    donorLastName: r.donor_last_name || null,
    donorEmail: r.donor_email || r.email || null,
    amount: r.donation_amount || 0,
    donationDate: r.donation_date || r.paid_at || r.created_at,
    source: r.source || null,
    origin: r.origin || null,
    paymentMethod: r.payment_method || null,
    orderId: r.order_id || null,
    amountRefunded: r.amount_refunded || 0,
    // Stewardship fields
    thankYouSent: r.thank_you_sent || false,
    thankYouDate: r.thank_you_date || null,
    thankYouBy: r.thank_you_by || null,
    donorContactId: r.donor_contact || null,
    donorSegment: r.donor_segment || null,
    campaign: r.campaign || null,
    impactUpdateSent: r.impact_update_sent || false,
    impactUpdateDate: r.impact_update_date || null,
  }));
}

/**
 * Internal helper — returns all donations.
 */
async function loadDonations() {
  try {
    return await fetchDonationsFromSupabase();
  } catch (err) {
    console.error("Supabase donation query failed:", err.message);
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

  // Thank-you stats
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

// ---------------------------------------------------------------------------
// Create — manual donation entry
// ---------------------------------------------------------------------------

/** Create a new donation record in Supabase */
export async function createDonation(data) {
  try {
    const sb = getServerClient();
    const fields = {
      donor_first_name: data.donorFirstName || null,
      donor_last_name: data.donorLastName || null,
      donor_email: data.donorEmail || null,
      donation_amount: data.amount,
      donation_date: data.donationDate,
      source: data.source || null,
      payment_method: data.paymentMethod || null,
    };

    if (data.donationType) fields.donation_type = data.donationType;
    if (data.restricted !== undefined) fields.restricted = data.restricted;
    if (data.designation) fields.designation = data.designation;
    if (data.receiptStatus) fields.receipt_status = data.receiptStatus;

    const { data: result, error } = await sb
      .from("donations")
      .insert(fields)
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, id: result.id };
  } catch (err) {
    console.error("Create donation error:", err.message);
    return { success: false, error: err.message };
  }
}

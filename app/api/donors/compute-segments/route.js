import { NextResponse } from "next/server";

/**
 * POST /api/donors/compute-segments
 * Computes donor segments based on lifetime value and frequency,
 * then writes Donor_Segment__c to all Donation__c records.
 *
 * Segments:
 * - "Major ($500+)"  — lifetime total >= $500 OR single donation >= $500
 * - "Recurring"      — 3+ donations in last 12 months
 * - "Regular"        — 2+ donations, not Major or Recurring
 * - "First-Time"     — exactly 1 donation
 * - "Lapsed"         — last donation > 6 months ago, had 2+ prior
 */
export async function POST() {
  try {
    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json({ success: false, mock: true }, { status: 200 });
    }

    const { sfQuery, sfUpdate } = await import("@/lib/salesforce");

    // Try with Donor_Segment__c, fall back if field doesn't exist yet
    let donations;
    try {
      donations = await sfQuery(`
        SELECT Id, Donor_Email__c, Email__c, Donation_Amount__c,
               Donation_Date__c, Donor_Segment__c
        FROM Donation__c
        ORDER BY Donation_Date__c DESC NULLS LAST
      `);
    } catch {
      donations = await sfQuery(`
        SELECT Id, Donor_Email__c, Email__c, Donation_Amount__c,
               Donation_Date__c
        FROM Donation__c
        ORDER BY Donation_Date__c DESC NULLS LAST
      `);
    }

    // Group by email
    const byEmail = {};
    for (const d of donations) {
      const email = d.Donor_Email__c || d.Email__c || d.Id;
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push(d);
    }

    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    let updated = 0;
    const breakdown = {};
    const updateErrors = [];

    for (const [, dons] of Object.entries(byEmail)) {
      const total = dons.reduce((s, d) => s + (d.Donation_Amount__c || 0), 0);
      const maxSingle = Math.max(...dons.map((d) => d.Donation_Amount__c || 0));
      const sorted = dons.sort(
        (a, b) =>
          new Date(b.Donation_Date__c || 0) - new Date(a.Donation_Date__c || 0)
      );
      const lastDate = sorted[0].Donation_Date__c
        ? new Date(sorted[0].Donation_Date__c)
        : null;
      const recentCount = dons.filter(
        (d) =>
          d.Donation_Date__c && new Date(d.Donation_Date__c) > twelveMonthsAgo
      ).length;

      let segment;
      if (total >= 500 || maxSingle >= 500) {
        segment = "Major ($500+)";
      } else if (recentCount >= 3) {
        segment = "Recurring";
      } else if (dons.length >= 2 && lastDate && lastDate < sixMonthsAgo) {
        segment = "Lapsed";
      } else if (dons.length >= 2) {
        segment = "Regular";
      } else {
        segment = "First-Time";
      }

      breakdown[segment] = (breakdown[segment] || 0) + dons.length;

      // Update all donations for this donor
      for (const d of dons) {
        if (d.Donor_Segment__c !== segment) {
          try {
            await sfUpdate("Donation__c", d.Id, { Donor_Segment__c: segment });
            updated++;
          } catch (err) {
            if (updateErrors.length < 5) updateErrors.push({ id: d.Id, segment, error: err.message });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalDonations: donations.length,
      uniqueDonors: Object.keys(byEmail).length,
      updated,
      breakdown,
      updateErrors: updateErrors.length > 0 ? updateErrors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

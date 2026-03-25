import { NextResponse } from "next/server";

/**
 * GET /api/donors/year-end-report?year=2025&email=donor@example.com
 * Generates a year-end donation summary for a specific donor or all donors.
 * Used for tax receipt / stewardship reporting.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear() - 1;
    const email = searchParams.get("email");

    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json({ success: false, mock: true }, { status: 200 });
    }

    const { sfQuery } = await import("@/lib/salesforce");

    let soql = `
      SELECT Id, Donor_First_Name__c, Donor_Last_Name__c, Billing_Name__c,
             Donor_Email__c, Email__c, Donation_Amount__c, Donation_Date__c
      FROM Donation__c
      WHERE CALENDAR_YEAR(Donation_Date__c) = ${year}
    `;

    if (email) {
      soql += ` AND (Donor_Email__c = '${email.replace(/'/g, "\\'")}' OR Email__c = '${email.replace(/'/g, "\\'")}')`;
    }

    soql += " ORDER BY Donation_Date__c ASC";

    const donations = await sfQuery(soql);

    // Group by donor email
    const byDonor = {};
    for (const d of donations) {
      const key = d.Donor_Email__c || d.Email__c || d.Id;
      if (!byDonor[key]) {
        byDonor[key] = {
          email: d.Donor_Email__c || d.Email__c,
          name:
            d.Billing_Name__c ||
            [d.Donor_First_Name__c, d.Donor_Last_Name__c]
              .filter(Boolean)
              .join(" ") ||
            null,
          donations: [],
          total: 0,
        };
      }
      byDonor[key].donations.push({
        date: d.Donation_Date__c,
        amount: d.Donation_Amount__c || 0,
      });
      byDonor[key].total += d.Donation_Amount__c || 0;
    }

    const reports = Object.values(byDonor).map((donor) => ({
      ...donor,
      count: donor.donations.length,
      firstDate: donor.donations[0]?.date,
      lastDate: donor.donations[donor.donations.length - 1]?.date,
    }));

    reports.sort((a, b) => b.total - a.total);

    return NextResponse.json({
      success: true,
      year,
      totalDonors: reports.length,
      totalRaised: reports.reduce((s, r) => s + r.total, 0),
      totalDonations: donations.length,
      ein: "84-3689498",
      orgName: "Steel Hearts 501(c)(3)",
      reports: email ? reports : reports.slice(0, 100),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

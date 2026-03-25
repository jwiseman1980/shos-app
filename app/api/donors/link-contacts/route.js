import { NextResponse } from "next/server";

/**
 * POST /api/donors/link-contacts
 * Backfills Donor_Contact__c lookup on Donation__c records by matching email.
 * Safe to re-run — only updates records where Donor_Contact__c is null.
 */
export async function POST() {
  try {
    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json({ success: false, mock: true }, { status: 200 });
    }

    const { sfQuery, sfUpdate } = await import("@/lib/salesforce");

    // Get donations missing contact link but having an email
    const donations = await sfQuery(`
      SELECT Id, Donor_Email__c, Email__c
      FROM Donation__c
      WHERE Donor_Contact__c = null
      AND (Donor_Email__c != null OR Email__c != null)
    `);

    let linked = 0;
    let unmatched = 0;
    const results = [];

    for (const don of donations) {
      const email = don.Donor_Email__c || don.Email__c;
      if (!email) {
        unmatched++;
        continue;
      }

      try {
        const contacts = await sfQuery(
          `SELECT Id, Name FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`
        );

        if (contacts.length > 0) {
          await sfUpdate("Donation__c", don.Id, {
            Donor_Contact__c: contacts[0].Id,
          });
          linked++;
          results.push({
            donationId: don.Id,
            email,
            contactId: contacts[0].Id,
            contactName: contacts[0].Name,
            status: "linked",
          });
        } else {
          unmatched++;
          results.push({ donationId: don.Id, email, status: "no_contact_match" });
        }
      } catch (err) {
        results.push({ donationId: don.Id, email, status: "error", error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      total: donations.length,
      linked,
      unmatched,
      results: results.slice(0, 50),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

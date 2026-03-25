import { NextResponse } from "next/server";

/**
 * PATCH /api/donors/update
 * Updates stewardship fields on a Donation__c record in Salesforce.
 *
 * Body: {
 *   sfId: "a15V500000LNKd3IAH",       // required
 *   thankYouSent: true,                // Thank_You_Sent__c
 *   thankYouBy: "Kristin Hughes",      // Thank_You_By__c
 *   campaign: "Legacies Alive 2026",   // Campaign__c
 *   donorSegment: "Regular",           // Donor_Segment__c
 *   impactUpdateSent: true,            // Impact_Update_Sent__c
 * }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { sfId, thankYouSent, thankYouBy, campaign, donorSegment, impactUpdateSent } = body;

    if (!sfId) {
      return NextResponse.json({ error: "sfId is required" }, { status: 400 });
    }

    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "Salesforce is not connected. Set SF_LIVE=true to enable write-back.",
          mock: true,
        },
        { status: 200 }
      );
    }

    const { sfUpdate } = await import("@/lib/salesforce");
    const updateData = {};

    if (thankYouSent !== undefined) {
      updateData.Thank_You_Sent__c = thankYouSent;
      if (thankYouSent) {
        updateData.Thank_You_Date__c = new Date().toISOString().split("T")[0];
      } else {
        updateData.Thank_You_Date__c = null;
        updateData.Thank_You_By__c = null;
      }
    }

    if (thankYouBy !== undefined) {
      updateData.Thank_You_By__c = thankYouBy;
    }

    if (campaign !== undefined) {
      updateData.Campaign__c = campaign || null;
    }

    if (donorSegment !== undefined) {
      updateData.Donor_Segment__c = donorSegment || null;
    }

    if (impactUpdateSent !== undefined) {
      updateData.Impact_Update_Sent__c = impactUpdateSent;
      if (impactUpdateSent) {
        updateData.Impact_Update_Date__c = new Date().toISOString().split("T")[0];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await sfUpdate("Donation__c", sfId, updateData);

    return NextResponse.json({ success: true, updated: updateData, sfId });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

/**
 * PATCH /api/messages/update
 * Updates Status__c on one or more Family_Message__c records.
 *
 * Single:  { sfId: "a14...", status: "Ready to Send" }
 * Bulk:    { sfIds: ["a14...", ...], status: "Ready to Send" }
 *
 * Valid statuses: New, Ready to Send, Held, Sent
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { sfId, sfIds, status } = body;

    // Validate status
    const validStatuses = ["New", "Ready to Send", "Held", "Sent"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Determine IDs to update
    const ids = sfIds || (sfId ? [sfId] : []);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "sfId or sfIds is required" },
        { status: 400 }
      );
    }

    // Check if SF is enabled
    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json(
        {
          success: false,
          error: "Salesforce not connected. Set SF_LIVE=true to enable.",
          mock: true,
          wouldUpdate: ids.length,
        },
        { status: 200 }
      );
    }

    const { sfUpdate } = await import("@/lib/salesforce");

    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const id of ids) {
      try {
        await sfUpdate("Family_Message__c", id, { Status__c: status });
        updated++;
      } catch (err) {
        failed++;
        errors.push({ id, error: err.message });
        console.warn(`Failed to update ${id}:`, err.message);
      }
    }

    return NextResponse.json({
      success: failed === 0,
      updated,
      failed,
      status,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

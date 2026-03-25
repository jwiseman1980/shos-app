import { NextResponse } from "next/server";

/**
 * POST /api/messages/cleanup
 * Delete duplicate/spam Family_Message__c records from Salesforce.
 *
 * Body: { action: "delete", ids: ["a14V5...", ...] }
 *
 * Safety: requires SF_LIVE=true. Deletes one at a time with error tracking.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ids } = body;

    if (action !== "delete") {
      return NextResponse.json(
        { error: 'Only action "delete" is supported' },
        { status: 400 }
      );
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array of Salesforce record IDs" },
        { status: 400 }
      );
    }

    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json({
        success: false,
        error: "SF_LIVE is not enabled. Set SF_LIVE=true to delete records.",
        mock: true,
        wouldDelete: ids.length,
      });
    }

    const { sfDelete } = await import("@/lib/salesforce");

    const results = { deleted: 0, failed: 0, errors: [] };

    for (const id of ids) {
      try {
        await sfDelete("Family_Message__c", id);
        results.deleted++;
      } catch (err) {
        results.failed++;
        results.errors.push({ id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Deleted ${results.deleted} of ${ids.length} records${results.failed > 0 ? ` (${results.failed} failed)` : ""}`,
    });
  } catch (error) {
    console.error("Message cleanup error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

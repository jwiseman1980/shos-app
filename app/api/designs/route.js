import { NextResponse } from "next/server";
import { sfUpdate, sfQuery } from "@/lib/salesforce";

const SF_LIVE = process.env.SF_LIVE === "true";

/**
 * GET /api/designs — Get design queue data
 */
export async function GET() {
  if (!SF_LIVE) {
    return NextResponse.json({ success: false, mock: true, items: [] });
  }
  try {
    const items = await sfQuery(
      `SELECT Id, Name, Rank__c, Lineitem_sku__c,
              Design_Status__c, Design_Priority__c, Design_Brief__c, Design_Due_Date__c,
              Service_Academy_or_Branch__c, Incident__c
       FROM Memorial_Bracelet__c
       WHERE Design_Status__c IN ('Queued', 'In Progress', 'Submitted')
       ORDER BY CreatedDate DESC`
    );
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/designs — Queue a hero for design
 * Body: { heroId, priority, brief, dueDate }
 */
export async function POST(request) {
  if (!SF_LIVE) {
    return NextResponse.json({ success: false, mock: true, message: "SF not configured" });
  }
  try {
    const { heroId, priority, brief, dueDate } = await request.json();

    if (!heroId) {
      return NextResponse.json({ error: "heroId is required" }, { status: 400 });
    }

    const updateData = {
      Design_Status__c: "Queued",
    };
    if (priority) updateData.Design_Priority__c = priority;
    if (brief) updateData.Design_Brief__c = brief;
    if (dueDate) updateData.Design_Due_Date__c = dueDate;

    await sfUpdate("Memorial_Bracelet__c", heroId, updateData);

    return NextResponse.json({
      success: true,
      message: "Design task queued",
    });
  } catch (error) {
    console.error("Failed to queue design:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/designs — Update a design task's status
 * Body: { heroId, status, brief }
 */
export async function PATCH(request) {
  if (!SF_LIVE) {
    return NextResponse.json({ success: false, mock: true, message: "SF not configured" });
  }
  try {
    const { heroId, status, brief } = await request.json();

    if (!heroId || !status) {
      return NextResponse.json(
        { error: "heroId and status are required" },
        { status: 400 }
      );
    }

    const updateData = { Design_Status__c: status };
    if (brief) updateData.Design_Brief__c = brief;

    // If completing, also mark design as created
    if (status === "Complete") {
      updateData.Bracelet_Design_Created__c = true;
      updateData.Has_Graphic_Design__c = true;
    }

    await sfUpdate("Memorial_Bracelet__c", heroId, updateData);

    return NextResponse.json({
      success: true,
      message: `Design status updated to "${status}"`,
    });
  } catch (error) {
    console.error("Failed to update design:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * PATCH /api/anniversaries/status
 * Update anniversary status and/or notes for a hero.
 *
 * Body: { sfId, status?, notes? }
 */
export async function PATCH(request) {
  try {
    const { sfId, status, notes } = await request.json();

    if (!sfId) {
      return NextResponse.json({ error: "sfId is required" }, { status: 400 });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.anniversary_status = status;
    if (notes !== undefined) updates.anniversary_notes = notes;

    const supabase = getServerClient();
    const { error } = await supabase
      .from("heroes")
      .update(updates)
      .eq("sf_id", sfId);

    if (error) {
      console.error("[anniversary-status] Supabase update failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mirror to Salesforce
    if (status && process.env.SF_LIVE === "true") {
      try {
        const { sfUpdate } = await import("@/lib/salesforce");
        const sfStatus = status === "sent" ? "Sent" : status === "email_drafted" ? "In Progress" : status;
        await sfUpdate("Memorial_Bracelet__c", sfId, {
          Anniversary_Status__c: sfStatus,
        });
      } catch (sfErr) {
        console.warn("[anniversary-status] SF mirror failed:", sfErr.message);
      }
    }

    return NextResponse.json({ success: true, sfId, status, notes });
  } catch (error) {
    console.error("[anniversary-status] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

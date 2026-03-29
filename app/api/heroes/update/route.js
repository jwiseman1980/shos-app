import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * PATCH /api/heroes/update
 * Updates anniversary fields on a hero record.
 * Writes to Supabase FIRST (primary), then mirrors to Salesforce (backup).
 *
 * Body: {
 *   sfId: "a0uKj00000flMOpIAM",        // Salesforce ID (used to find the Supabase record)
 *   status: "In Progress",              // anniversary_status
 *   assignedTo: "uuid-or-sf-id",        // anniversary_assigned_to
 *   assignedToName: "Chris Marti",      // Looks up volunteer by name
 *   notes: "some note",                 // anniversary_notes
 *   completedDate: "2026-03-20",        // anniversary_completed_date
 *   heroName: "CPT John Smith"          // Optional — for Slack messages
 * }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { sfId, status, assignedTo, assignedToName, notes, completedDate, heroName } = body;

    if (!sfId) {
      return NextResponse.json({ error: "sfId is required" }, { status: 400 });
    }

    const supabase = getServerClient();

    // Build Supabase update payload
    const sbUpdate = {};
    const sfUpdate = {};

    // Status
    if (status !== undefined) {
      // Normalize for Supabase enum (lowercase, underscored)
      const sbStatus = status.toLowerCase().replace(/\s+/g, "_");
      sbUpdate.anniversary_status = sbStatus;
      sfUpdate.Anniversary_Status__c = status;
    }

    // Assignment by name — look up in volunteers/users
    if (assignedToName !== undefined && assignedTo === undefined) {
      if (assignedToName) {
        // Look up user in Supabase by display_name
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .ilike("display_name", assignedToName)
          .limit(1)
          .single();

        if (user) {
          sbUpdate.anniversary_assigned_to = user.id;
        }
      } else {
        sbUpdate.anniversary_assigned_to = null;
      }
    } else if (assignedTo !== undefined) {
      sbUpdate.anniversary_assigned_to = assignedTo || null;
    }

    // Notes
    if (notes !== undefined) {
      sbUpdate.anniversary_notes = notes;
      sfUpdate.Anniversary_Notes__c = notes;
    }

    // Completed date
    if (completedDate !== undefined) {
      sbUpdate.anniversary_completed_date = completedDate || null;
      sfUpdate.Anniversary_Completed_Date__c = completedDate || null;
    }

    // Auto-set completed date when status is complete/sent
    if (
      status &&
      ["Complete", "Completed", "Sent", "complete", "sent"].includes(status) &&
      !completedDate
    ) {
      const today = new Date().toISOString().split("T")[0];
      sbUpdate.anniversary_completed_date = today;
      sfUpdate.Anniversary_Completed_Date__c = today;
    }

    if (Object.keys(sbUpdate).length === 0 && Object.keys(sfUpdate).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // --- WRITE 1: Supabase (primary) ---
    if (Object.keys(sbUpdate).length > 0) {
      sbUpdate.updated_at = new Date().toISOString();

      const { error: sbErr } = await supabase
        .from("heroes")
        .update(sbUpdate)
        .eq("sf_id", sfId);

      if (sbErr) {
        console.error("[heroes/update] Supabase write failed:", sbErr.message);
        // Don't return — still try SF as fallback
      }
    }

    // --- WRITE 2: Salesforce (backup mirror) ---
    if (process.env.SF_LIVE === "true" && Object.keys(sfUpdate).length > 0) {
      try {
        const { sfUpdate: sfDoUpdate, sfQuery } = await import("@/lib/salesforce");

        // Look up SF user for assignment if we have a name
        if (assignedToName !== undefined && assignedTo === undefined) {
          if (assignedToName) {
            try {
              const users = await sfQuery(
                `SELECT Id FROM User WHERE Name = '${assignedToName.replace(/'/g, "\\'")}' AND IsActive = true LIMIT 1`
              );
              if (users.length > 0) {
                sfUpdate.Anniversary_Assigned_To__c = users[0].Id;
              }
            } catch (lookupErr) {
              console.warn(`SF User lookup failed: ${lookupErr.message}`);
            }
          } else {
            sfUpdate.Anniversary_Assigned_To__c = null;
          }
        } else if (assignedTo !== undefined) {
          sfUpdate.Anniversary_Assigned_To__c = assignedTo || null;
        }

        await sfDoUpdate("Memorial_Bracelet__c", sfId, sfUpdate);
      } catch (sfErr) {
        console.warn("[heroes/update] SF mirror failed:", sfErr.message);
        // Best effort — Supabase is the primary, SF failing is not fatal
      }
    }

    // --- Slack notification on completion ---
    const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
    if (
      slackWebhook &&
      status &&
      ["Complete", "Completed", "Sent", "complete", "sent"].includes(status)
    ) {
      try {
        const displayName = heroName || sfId;
        const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
        await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `:white_check_mark: Anniversary complete — *${displayName}* marked ${status} (${dateStr})`,
            unfurl_links: false,
          }),
        });
      } catch {
        // Slack is best-effort
      }
    }

    return NextResponse.json({
      success: true,
      updated: { ...sbUpdate, ...sfUpdate },
      sfId,
    });
  } catch (error) {
    console.error("[heroes/update] Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

/**
 * PATCH /api/heroes/update
 * Updates anniversary fields on a Memorial_Bracelet__c record in Salesforce.
 *
 * Body: {
 *   sfId: "a0uKj00000flMOpIAM",
 *   status: "In Progress",          // Anniversary_Status__c
 *   assignedTo: "003...",            // Anniversary_Assigned_To__c (Contact Id)
 *   assignedToName: "Chris Marti",   // Looks up Contact by name, sets Anniversary_Assigned_To__c
 *   notes: "some note",             // Anniversary_Notes__c
 *   completedDate: "2026-03-20",    // Anniversary_Completed_Date__c
 *   heroName: "CPT John Smith"      // Optional — for Slack messages
 * }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { sfId, status, assignedTo, assignedToName, notes, completedDate, heroName } = body;

    if (!sfId) {
      return NextResponse.json(
        { error: "sfId is required" },
        { status: 400 }
      );
    }

    // Check if SF is enabled
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

    const { sfUpdate, sfQuery } = await import("@/lib/salesforce");

    // Build the update payload — only include fields that were provided
    const updateData = {};

    if (status !== undefined) {
      updateData.Anniversary_Status__c = status;
    }

    if (assignedTo !== undefined) {
      updateData.Anniversary_Assigned_To__c = assignedTo || null;
    }

    // Look up User by name if assignedToName is provided
    // (Anniversary_Assigned_To__c is a User lookup, not Contact)
    if (assignedToName !== undefined && assignedTo === undefined) {
      if (assignedToName) {
        try {
          const users = await sfQuery(
            `SELECT Id FROM User WHERE Name = '${assignedToName.replace(/'/g, "\\'")}' AND IsActive = true LIMIT 1`
          );
          if (users.length > 0) {
            updateData.Anniversary_Assigned_To__c = users[0].Id;
          } else {
            console.warn(`SF User not found for name: ${assignedToName}`);
          }
        } catch (lookupErr) {
          console.warn(`User lookup failed: ${lookupErr.message}`);
        }
      } else {
        // Clearing assignment
        updateData.Anniversary_Assigned_To__c = null;
      }
    }

    if (notes !== undefined) {
      updateData.Anniversary_Notes__c = notes;
    }

    if (completedDate !== undefined) {
      updateData.Anniversary_Completed_Date__c = completedDate || null;
    }

    // Auto-set completed date when status is set to complete/sent
    if (
      status &&
      ["Complete", "Completed", "Sent"].includes(status) &&
      !completedDate
    ) {
      updateData.Anniversary_Completed_Date__c = new Date()
        .toISOString()
        .split("T")[0];
    }

    // Auto-set In Progress when first assigning
    if (
      updateData.Anniversary_Assigned_To__c &&
      !status
    ) {
      // Only auto-set if current status would be Not Started
      // We don't override existing status
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await sfUpdate("Memorial_Bracelet__c", sfId, updateData);

    // Post to Slack if webhook is configured and status changed to complete
    const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
    if (
      slackWebhook &&
      status &&
      ["Complete", "Completed", "Sent"].includes(status)
    ) {
      try {
        const displayName = heroName || sfId;
        const dateStr = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `:white_check_mark: Anniversary complete — *${displayName}* marked ${status} (${dateStr})`,
            unfurl_links: false,
          }),
        });
      } catch {
        // Slack post is best-effort
      }
    }

    return NextResponse.json({
      success: true,
      updated: updateData,
      sfId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

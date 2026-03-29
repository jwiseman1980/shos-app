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
        // Look up user in Supabase by name
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .ilike("name", assignedToName)
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

    const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
    const displayName = heroName || sfId;

    // --- Look up hero record for task creation and notifications ---
    const { data: heroRecord } = await supabase
      .from("heroes")
      .select("id, memorial_date, memorial_month, memorial_day")
      .eq("sf_id", sfId)
      .single();

    // --- Auto-create task when volunteer is assigned ---
    if (assignedToName) {
      try {
        // Look up assignee's user ID
        const { data: taskUser } = await supabase
          .from("users")
          .select("id")
          .ilike("name", assignedToName)
          .limit(1)
          .single();

        // Check if an open anniversary task already exists for this hero
        const existingCheck = heroRecord?.id
          ? await supabase
              .from("tasks")
              .select("id")
              .eq("hero_id", heroRecord.id)
              .eq("domain", "anniversary")
              .in("status", ["backlog", "todo", "in_progress"])
              .limit(1)
          : { data: [] };

        if (!existingCheck.data?.length) {
          await supabase.from("tasks").insert({
            title: `Send anniversary email — ${displayName}`,
            description: `Create and send the remembrance email for ${displayName}. Go to the Anniversary Email Tracker to draft and send.`,
            status: "todo",
            priority: "medium",
            role: "family",
            domain: "anniversary",
            hero_id: heroRecord?.id || null,
            assigned_to: taskUser?.id || null,
            tags: ["anniversary", "email"],
          });
        }
      } catch (taskErr) {
        console.warn("[heroes/update] Task auto-creation failed:", taskErr.message);
      }
    }

    // --- Notify volunteer on assignment (email + Slack) ---
    if (assignedToName && assignedToName !== "Joseph Wiseman") {
      // Look up volunteer email
      const { data: assignedUser } = await supabase
        .from("users")
        .select("email, name")
        .ilike("name", assignedToName)
        .limit(1)
        .single();

      if (assignedUser?.email) {
        // Email notification
        try {
          const { sendGmailMessage } = await import("@/lib/gmail");
          await sendGmailMessage({
            senderEmail: "joseph.wiseman@steel-hearts.org",
            senderName: "Steel Hearts",
            to: assignedUser.email,
            subject: `Anniversary Assignment — ${displayName}`,
            body: [
              `Hi ${assignedUser.name.split(" ")[0]},`,
              "",
              `You've been assigned to handle the anniversary remembrance for ${displayName}.`,
              "",
              `Please log into the SHOS app and navigate to the Anniversary Tracker to review the details and create the email draft when you're ready.`,
              "",
              `https://shos-app.vercel.app/anniversaries`,
              "",
              "Thank you for helping us honor their memory.",
              "",
              "— Steel Hearts",
            ].join("\n"),
          });
        } catch (emailErr) {
          console.warn("[heroes/update] Assignment email failed:", emailErr.message);
        }
      }

      // Slack notification
      if (slackWebhook) {
        try {
          await fetch(slackWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `:memo: Anniversary assigned — *${displayName}* → ${assignedToName}`,
              unfurl_links: false,
            }),
          });
        } catch {
          // Best effort
        }
      }
    }

    // --- Auto-complete anniversary task when status is Sent/Complete ---
    if (
      status &&
      ["Complete", "Completed", "Sent", "complete", "sent"].includes(status) &&
      heroRecord?.id
    ) {
      try {
        await supabase
          .from("tasks")
          .update({ status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("hero_id", heroRecord.id)
          .eq("domain", "anniversary")
          .in("status", ["backlog", "todo", "in_progress"]);
      } catch {
        // Best effort
      }
    }

    // --- Slack notification on completion ---
    if (
      slackWebhook &&
      status &&
      ["Complete", "Completed", "Sent", "complete", "sent"].includes(status)
    ) {
      try {
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

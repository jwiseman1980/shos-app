import { NextResponse } from "next/server";
import { sfCreate, sfQuery } from "@/lib/salesforce";

/**
 * POST /api/sop-runs — Log a completed SOP run to Salesforce + Slack
 * GET /api/sop-runs?date=YYYY-MM-DD — Get runs for a specific date (default: today)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sopId, sopTitle, completedSteps, totalSteps, completedAt, runner, runnerEmail } = body;

    if (!sopId || !sopTitle) {
      return NextResponse.json({ error: "sopId and sopTitle are required" }, { status: 400 });
    }

    const results = { logged: true, slack: false, salesforce: false };

    // Log to Salesforce Task_Log__c
    if (process.env.SF_LIVE === "true") {
      try {
        await sfCreate("Task_Log__c", {
          Task_Type__c: "SOP Run",
          Task_Reference__c: `${sopId}: ${sopTitle}`,
          Completed_By__c: runner || "Unknown",
          Completed_By_Email__c: runnerEmail || null,
          Completed_At__c: completedAt || new Date().toISOString(),
          Duration_Minutes__c: null,
          Notes__c: `${completedSteps}/${totalSteps} steps completed`,
          Related_Record_Id__c: null,
        });
        results.salesforce = true;
      } catch (sfErr) {
        results.salesforceError = sfErr.message;
      }
    }

    // Post to Slack if webhook is configured
    const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
    if (slackWebhook) {
      try {
        const dateStr = new Date(completedAt || Date.now()).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });

        let messageText;
        if (sopId === "SOP-001") {
          messageText = `:white_check_mark: *SOP-001 complete* — Daily Social Media Engagement\nDMs: responded, Comments: reviewed, Invites: sent, Stories: shared. ${dateStr}`;
        } else {
          messageText = `:white_check_mark: *${sopId}* complete — ${sopTitle}\n${completedSteps}/${totalSteps} steps · ${runner || "Unknown"} · ${dateStr}`;
        }

        const slackRes = await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: messageText, unfurl_links: false }),
        });
        results.slack = slackRes.ok;
      } catch (slackErr) {
        results.slackError = slackErr.message;
      }
    }

    return NextResponse.json({
      success: true,
      run: { sopId, sopTitle, completedSteps, totalSteps, completedAt, runner },
      ...results,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const type = searchParams.get("type") || "SOP Run";
    const user = searchParams.get("user");

    if (process.env.SF_LIVE !== "true") {
      return NextResponse.json({ runs: [], source: "offline" });
    }

    let soql = `SELECT Id, Task_Type__c, Task_Reference__c, Completed_By__c, Completed_By_Email__c, Completed_At__c, Notes__c
      FROM Task_Log__c
      WHERE Task_Type__c = '${type}'
        AND DAY_ONLY(Completed_At__c) = ${date}`;

    if (user) {
      soql += ` AND Completed_By__c = '${user.replace(/'/g, "\\'")}'`;
    }

    soql += " ORDER BY Completed_At__c DESC";

    const runs = await sfQuery(soql);
    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.Id,
        taskType: r.Task_Type__c,
        reference: r.Task_Reference__c,
        completedBy: r.Completed_By__c,
        completedAt: r.Completed_At__c,
        notes: r.Notes__c,
      })),
      source: "salesforce",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message, runs: [] }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

/**
 * POST /api/sop-runs
 * Logs a completed SOP run and posts to Slack.
 *
 * Body: {
 *   sopId: "SOP-001",
 *   sopTitle: "Daily Social Media Engagement",
 *   completedSteps: 6,
 *   totalSteps: 6,
 *   completedAt: "2026-03-20T14:45:00.000Z",
 *   runner: "Joseph Wiseman"
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sopId, sopTitle, completedSteps, totalSteps, completedAt, runner } =
      body;

    if (!sopId || !sopTitle) {
      return NextResponse.json(
        { error: "sopId and sopTitle are required" },
        { status: 400 }
      );
    }

    const results = { logged: true, slack: false };

    // Post to Slack if webhook is configured
    const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
    if (slackWebhook) {
      try {
        const dateStr = new Date(completedAt || Date.now()).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", year: "numeric" }
        );

        // SOP-specific messages
        let messageText;
        if (sopId === "SOP-001") {
          messageText = `:white_check_mark: *SOP-001 complete* — Daily Social Media Engagement\nDMs: responded, Comments: reviewed, Invites: sent, Stories: shared. ${dateStr}`;
        } else {
          messageText = `:white_check_mark: *${sopId}* complete — ${sopTitle}\n${completedSteps}/${totalSteps} steps · ${runner || "Unknown"} · ${dateStr}`;
        }

        const slackRes = await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: messageText,
            unfurl_links: false,
          }),
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

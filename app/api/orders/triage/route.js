import { NextResponse } from "next/server";
import { triageNeedsDecision } from "@/lib/data/orders";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;
const SLACK_DM_JOSEPH = process.env.SLACK_DM_JOSEPH;
const SLACK_DM_RYAN = process.env.SLACK_DM_RYAN;

async function postToSlack(text, webhook = SLACK_WEBHOOK) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("Slack post failed:", e.message);
  }
}

/** Send to ops hub + person's DM */
async function notifyPerson(text, dmWebhook) {
  await Promise.all([
    postToSlack(text),
    dmWebhook ? postToSlack(text, dmWebhook) : Promise.resolve(),
  ]);
}

/**
 * POST /api/orders/triage — Auto-triage all "Needs Decision" order items.
 * Items with existing designs → "Ready to Laser"
 * Items without designs → "Design Needed"
 * Items with no matching hero → stay for manual review
 */
// GET for Vercel cron, POST for manual calls
export async function GET() { return handler(); }
export async function POST() { return handler(); }

async function handler() {
  try {
    const result = await triageNeedsDecision();

    // Send Slack notifications for triaged items
    if (result.results) {
      for (const item of result.results) {
        if (item.action === "advanced") {
          // Design exists, ready to laser → ops hub + DM Joseph
          await notifyPerson(
            `🔥 ${item.name} bracelet auto-advanced to Ready to Laser (design found)`,
            SLACK_DM_JOSEPH
          );
        } else if (item.action === "needsDesign") {
          // No design → ops hub + DM Ryan
          await notifyPerson(
            `🎨 New design task: ${item.name} bracelet needs a design`,
            SLACK_DM_RYAN
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
      message: `Triage complete: ${result.advanced} advanced, ${result.needsDesign} need design, ${result.skipped} need manual review`,
    });
  } catch (error) {
    console.error("Triage error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

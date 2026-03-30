import { NextResponse } from "next/server";
import { triageNeedsDecision } from "@/lib/data/orders";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;
const SLACK_DM_JOSEPH = process.env.SLACK_DM_JOSEPH;
const SLACK_DM_RYAN = process.env.SLACK_DM_RYAN;
const SLACK_DM_KRISTIN = process.env.SLACK_DM_KRISTIN;

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
export const dynamic = "force-dynamic";

// GET for Vercel cron, POST for manual calls
export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }

async function handler(request) {
  // Auth: Vercel CRON_SECRET or SHOS_API_KEY
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const providedKey = new URL(request.url).searchParams.get("key") || request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && providedKey === apiKey;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        } else if (item.action === "fromStock") {
          // Burnout stock exists, ready to ship → ops hub + DM Kristin
          await notifyPerson(
            `📦 ${item.name} bracelet fulfilled from burnout stock → Ready to Ship (${item.stockAfter} remaining)`,
            SLACK_DM_KRISTIN
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
      message: `Triage complete: ${result.advanced} to laser, ${result.fromStock || 0} from stock, ${result.needsDesign} need design, ${result.skipped} need manual review`,
    });
  } catch (error) {
    console.error("Triage error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

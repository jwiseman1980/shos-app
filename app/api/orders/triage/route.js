import { NextResponse } from "next/server";
import { triageNeedsDecision } from "@/lib/data/orders";
import {
  buildDesignNeededMessage,
  buildReadyToLaserMessage,
  buildReadyToShipMessage,
  notifyWithDm,
} from "@/lib/slack-actions";

const SLACK_DM_JOSEPH = process.env.SLACK_DM_JOSEPH;
const SLACK_DM_RYAN = process.env.SLACK_DM_RYAN;
const SLACK_DM_KRISTIN = process.env.SLACK_DM_KRISTIN;

export const dynamic = "force-dynamic";

// GET for Vercel cron, POST for manual calls
export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }

async function handler(request) {
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

    if (result.results) {
      for (const item of result.results) {
        if (item.action === "advanced") {
          // Design exists → ready to laser → DM Joseph with download + action links
          const msg = buildReadyToLaserMessage(item.name, item.name, null, [item.id]);
          await notifyWithDm(msg, SLACK_DM_JOSEPH);
        } else if (item.action === "fromStock") {
          // Burnout stock → ready to ship → DM Kristin with ship link
          const msg = buildReadyToShipMessage("", `${item.name} (from stock, ${item.stockAfter} remaining)`, [item.id]);
          await notifyWithDm(msg, SLACK_DM_KRISTIN);
        } else if (item.action === "needsDesign") {
          // No design → DM Ryan with upload link
          const msg = buildDesignNeededMessage(item.name, item.name, null, 1);
          await notifyWithDm(msg, SLACK_DM_RYAN);
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

import { NextResponse } from "next/server";
import { triageNeedsDecision } from "@/lib/data/orders";
import {
  buildDesignNeededMessage,
  buildReadyToLaserMessage,
  buildReadyToShipMessage,
  sendSlackDm,
  notifyWithDm,
} from "@/lib/slack-actions";

export const dynamic = "force-dynamic";

// GET for Vercel cron, POST for manual calls
export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }

async function handler(request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const providedKey = request.headers.get("x-api-key");

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
          // Design exists → ready to laser → DM Joseph
          const msg = buildReadyToLaserMessage(item.name, item.name, null, [item.id]);
          await sendSlackDm("joseph.wiseman@steel-hearts.org", msg);
        } else if (item.action === "fromStock") {
          // Burnout stock → ready to ship → DM Kristin
          const msg = buildReadyToShipMessage("", `${item.name} (from stock, ${item.stockAfter} remaining)`, [item.id]);
          await sendSlackDm("kristin.hughes@steel-hearts.org", msg);
        } else if (item.action === "needsDesign") {
          // No design → DM Ryan with rich design-needed message
          const msg = buildDesignNeededMessage(item.name, item.sku || item.name, item.size, 1, item.heroId);
          await sendSlackDm("ryan.santana@steel-hearts.org", msg);
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

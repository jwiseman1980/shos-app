import { NextResponse } from "next/server";
import { buildDesignNeededMessage, postWebhook } from "@/lib/slack-actions";

const SLACK_DM_RYAN = process.env.SLACK_DM_RYAN;
const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;

/**
 * POST /api/slack/notify-design
 * Body: { sku, heroName, heroId, orderCount }
 * Re-ping Ryan with a design-needed message WITHOUT changing status in DB.
 * Used by the production board "Notify Ryan" button on design_needed cards.
 */
export async function POST(request) {
  try {
    const { sku, heroName, heroId, orderCount } = await request.json();

    if (!sku || !heroName) {
      return NextResponse.json({ error: "sku and heroName required" }, { status: 400 });
    }

    const msg = buildDesignNeededMessage(heroName, sku, null, orderCount || 1, heroId);

    await Promise.all([
      SLACK_DM_RYAN ? postWebhook(SLACK_DM_RYAN, msg) : Promise.resolve(),
      SLACK_WEBHOOK ? postWebhook(SLACK_WEBHOOK, msg) : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("notify-design error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

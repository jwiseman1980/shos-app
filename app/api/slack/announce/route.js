import { NextResponse } from "next/server";
import { postToSlack } from "@/lib/slack";

export const dynamic = "force-dynamic";

/**
 * POST /api/slack/announce — post a message to a Slack channel
 * Body: { text, channel }
 * Channels: "ops", "joseph", "ryan", "kristin"
 */
export async function POST(request) {
  try {
    const { text, channel = "ops" } = await request.json();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    await postToSlack(channel, text);
    return NextResponse.json({ success: true, channel });
  } catch (err) {
    console.error("Slack announce error:", err.message);
    return NextResponse.json(
      { error: "Slack post failed", message: err.message },
      { status: 500 }
    );
  }
}

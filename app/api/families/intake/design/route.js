import { NextResponse } from "next/server";
import { setDesignBrief } from "@/lib/data/families";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;
const SLACK_DM_RYAN = process.env.SLACK_DM_RYAN;

async function postSlack(text, webhook) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("Slack failed:", e.message);
  }
}

/** POST — Step 5: Set design brief */
export async function POST(req) {
  try {
    const { heroId, heroName, designBrief, imageUrls = [] } = await req.json();

    if (!heroId || !designBrief) {
      return NextResponse.json(
        { success: false, error: "Missing required: heroId, designBrief" },
        { status: 400 }
      );
    }

    // Append image URLs to the brief so they're saved in SF
    const images = imageUrls.filter(Boolean);
    const fullBrief = images.length > 0
      ? `${designBrief}\n\n--- Reference Images ---\n${images.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
      : designBrief;

    const result = await setDesignBrief(heroId, fullBrief);

    if (result.success) {
      const preview = designBrief.length > 80 ? designBrief.slice(0, 80) + "..." : designBrief;
      const imgNote = images.length > 0 ? ` (${images.length} reference image${images.length > 1 ? "s" : ""})` : "";
      const msg = `\u{1F3A8} Design needed: ${heroName || "Hero"} \u2014 ${preview}${imgNote}`;
      await Promise.all([
        postSlack(msg, SLACK_WEBHOOK),
        postSlack(msg, SLACK_DM_RYAN),
      ]);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Set design brief error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

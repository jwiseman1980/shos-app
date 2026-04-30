import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { postToSlack } from "@/lib/slack";
import { tryAdvanceWorkflow } from "@/lib/hero-workflow";

const RYAN_SLACK_USER_ID = "U0AMW4VSX9P";

async function dmRyan(text) {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (botToken) {
    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: RYAN_SLACK_USER_ID,
          text,
          mrkdwn: true,
        }),
      });
      const data = await res.json();
      if (data.ok) return true;
      console.warn("[request-design] chat.postMessage failed:", data.error);
    } catch (err) {
      console.warn("[request-design] bot DM failed:", err.message);
    }
  }
  return postToSlack("ryan", text);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { hero_id, notes } = body;
  if (!hero_id) {
    return NextResponse.json({ error: "hero_id is required" }, { status: 400 });
  }

  const sb = getServerClient();
  const { data: hero, error: heroErr } = await sb
    .from("heroes")
    .select("id, name, lineitem_sku, design_brief")
    .eq("id", hero_id)
    .maybeSingle();

  if (heroErr || !hero) {
    return NextResponse.json({ error: "Hero not found" }, { status: 404 });
  }

  const sku = hero.lineitem_sku || "(no SKU)";
  const noteText = (notes && notes.trim()) || hero.design_brief || "(none)";

  const message = [
    `🎨 *New design request: ${hero.name}* (\`${sku}\`)`,
    `Sizes: 6" and 7"`,
    `Notes: ${noteText}`,
    `Files should be named \`${sku}-6.svg\` and \`${sku}-7.svg\``,
  ].join("\n");

  const slackOk = await dmRyan(message);

  const { error: updErr } = await sb
    .from("heroes")
    .update({
      design_status: "research",
      updated_at: new Date().toISOString(),
    })
    .eq("id", hero_id);

  if (updErr) {
    console.warn("[request-design] hero update failed:", updErr.message);
  }

  if (slackOk) {
    await tryAdvanceWorkflow(hero_id, "design_briefed");
  }

  return NextResponse.json({
    success: true,
    slack_sent: slackOk,
    hero: { id: hero.id, name: hero.name, sku },
  });
}

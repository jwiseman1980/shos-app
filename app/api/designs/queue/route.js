import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { sendSlackDm, buildDesignNeededMessage } from "@/lib/slack-actions";

/**
 * POST /api/designs/queue — Queue a proactive design task (no order required).
 * Sets the hero's design_status to "research" and updates the design_brief.
 *
 * Body: { heroId, sizes: ["6", "7"], brief? }
 */
export async function POST(request) {
  try {
    const { heroId, sizes, brief } = await request.json();

    if (!heroId) {
      return NextResponse.json({ error: "heroId is required" }, { status: 400 });
    }
    if (!sizes || !sizes.length) {
      return NextResponse.json({ error: "At least one size is required" }, { status: 400 });
    }

    const sb = getServerClient();

    // Verify hero exists
    const { data: hero, error: heroErr } = await sb
      .from("heroes")
      .select("id, name, lineitem_sku, design_status")
      .eq("id", heroId)
      .single();

    if (heroErr || !hero) {
      return NextResponse.json({ error: "Hero not found" }, { status: 404 });
    }

    // Build design brief
    const sizeLabels = sizes.map(s => `${s}"`).join(" + ");
    const autoBrief = `Proactive design queue: ${sizeLabels} sizes needed.`;
    const fullBrief = brief ? `${autoBrief}\n${brief}` : autoBrief;

    // Update hero record
    const { error: updateErr } = await sb
      .from("heroes")
      .update({
        design_status: "research",
        design_brief: fullBrief,
      })
      .eq("id", heroId);

    if (updateErr) throw updateErr;

    // Notify Ryan via Slack Bot API DM
    const slackMsg = [
      `🎨 *Proactive Design Request*`,
      ``,
      buildDesignNeededMessage(hero.name, hero.lineitem_sku, sizes.join('" + "'), 0, hero.id),
      ``,
      brief ? `📝 *Notes:* ${brief}` : "",
    ].filter(Boolean).join("\n");

    await sendSlackDm("ryan@steel-hearts.org", slackMsg);

    return NextResponse.json({
      success: true,
      message: `${hero.name} queued for ${sizeLabels} design`,
      heroName: hero.name,
      sku: hero.lineitem_sku,
      sizes,
    });
  } catch (error) {
    console.error("Queue design error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/designs/queue — Get proactive design queue (heroes queued without orders).
 */
export async function GET() {
  try {
    const sb = getServerClient();
    const { data, error } = await sb
      .from("heroes")
      .select("id, name, lineitem_sku, branch, rank, design_status, design_brief, created_at")
      .in("design_status", ["research", "in_progress", "review"])
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, items: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

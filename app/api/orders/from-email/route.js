import { NextResponse } from "next/server";
import { createDonatedOrder } from "@/lib/data/orders";
import { getServerClient } from "@/lib/supabase";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;
const SLACK_DM_JOSEPH = process.env.SLACK_DM_JOSEPH;

async function postToSlack(text, webhook) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {}
}

/**
 * POST /api/orders/from-email
 *
 * Creates a donated order from an email thread context.
 * Stores the Gmail thread ID in the order notes (+ source_email_thread_id if column exists).
 *
 * Body:
 *   threadId, mailbox, heroName, recipientName, recipientEmail,
 *   quantity6, quantity7, sku, notes,
 *   shippingName, shippingAddress1, shippingCity, shippingState, shippingPostal
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      threadId,
      heroName,
      recipientName,
      recipientEmail = "",
      quantity6 = 0,
      quantity7 = 1,
      sku = "",
      notes = "",
      shippingName = "",
      shippingAddress1 = "",
      shippingCity = "",
      shippingState = "",
      shippingPostal = "",
    } = body;

    if (!heroName || !recipientName) {
      return NextResponse.json(
        { error: "heroName and recipientName are required" },
        { status: 400 }
      );
    }

    const threadNote = threadId ? `Gmail thread: ${threadId}` : "";
    const fullNotes = [notes, threadNote].filter(Boolean).join(" | ");

    const result = await createDonatedOrder({
      heroName,
      recipientName,
      recipientEmail,
      quantity7: quantity7 || (quantity6 === 0 ? 1 : 0),
      quantity6: quantity6 || 0,
      source: "Email",
      notes: fullNotes,
      sku,
      shippingName,
      shippingAddress1,
      shippingCity,
      shippingState,
      shippingPostal,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Try to store threadId in dedicated column (graceful fail if column doesn't exist yet)
    if (threadId && result.orderId) {
      try {
        const sb = getServerClient();
        await sb
          .from("orders")
          .update({ source_email_thread_id: threadId })
          .eq("id", result.orderId);
      } catch {
        // Column may not exist until migration is applied — notes already captures it
      }
    }

    // Slack notification
    const slackMsg = `📧 *Order from email* — ${heroName} for ${recipientName} (${result.orderName})${threadId ? ` | Thread: ${threadId}` : ""}`;
    await Promise.all([
      postToSlack(slackMsg, SLACK_WEBHOOK),
      result.autoAdvanced
        ? postToSlack(`🔥 ${heroName} auto-advanced to Ready to Laser (design found)`, SLACK_DM_JOSEPH)
        : Promise.resolve(),
    ]);

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      orderName: result.orderName,
      autoAdvanced: result.autoAdvanced,
      initialStatus: result.initialStatus,
    });
  } catch (err) {
    console.error("[orders/from-email] error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

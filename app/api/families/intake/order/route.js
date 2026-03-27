import { NextResponse } from "next/server";
import { createDonatedOrder } from "@/lib/data/orders";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;
const SLACK_DM_JOSEPH = process.env.SLACK_DM_JOSEPH;

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

/** POST — Step 6: Create donated bracelet order */
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      heroName,
      recipientName,
      recipientEmail,
      sku,
      quantity7 = 0,
      quantity6 = 0,
      notes = "",
    } = body;

    if (!heroName) {
      return NextResponse.json(
        { success: false, error: "Missing required: heroName" },
        { status: 400 }
      );
    }

    const totalQty = (quantity7 || 0) + (quantity6 || 0) || 1;

    const result = await createDonatedOrder({
      heroName,
      recipientName: recipientName || heroName,
      recipientEmail: recipientEmail || "",
      quantity: totalQty,
      quantity6: quantity6 || 0,
      quantity7: quantity7 || 0,
      source: "Family Intake",
      notes,
      sku: sku || "",
    });

    if (result.success) {
      const msg = `\u{1F4E6} Donated order created: ${heroName} \u2014 ${totalQty} bracelet(s) [${result.initialStatus}]`;
      await Promise.all([
        postSlack(msg, SLACK_WEBHOOK),
        postSlack(msg, SLACK_DM_JOSEPH),
      ]);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Create order error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

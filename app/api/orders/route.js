import { NextResponse } from "next/server";
import { updateItemStatus, createDonatedOrder, getActiveOrderItems, getOrderStats } from "@/lib/data/orders";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;

async function postToSlack(text) {
  if (!SLACK_WEBHOOK) return;
  try {
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn("Slack post failed:", e.message);
  }
}

/**
 * GET /api/orders — Fetch active order items and stats
 */
export async function GET() {
  try {
    const [items, stats] = await Promise.all([
      getActiveOrderItems(),
      getOrderStats(),
    ]);
    return NextResponse.json({ success: true, items, stats });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orders — Update a line item's production status
 * Body: { itemId, status }
 */
export async function PATCH(request) {
  try {
    const { itemId, status, heroName } = await request.json();

    if (!itemId || !status) {
      return NextResponse.json(
        { error: "itemId and status are required" },
        { status: 400 }
      );
    }

    const result = await updateItemStatus(itemId, status);

    if (result.success) {
      const name = heroName || "Order item";
      if (status === "Ready to Laser") {
        await postToSlack(`\ud83d\udd25 ${name} bracelet ready for laser production`);
      } else if (status === "Ready to Ship") {
        await postToSlack(`\ud83d\udce6 ${name} bracelet ready to ship`);
      } else if (status === "Shipped") {
        await postToSlack(`\u2705 ${name} bracelet shipped`);
      }
    }

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Production status updated to "${status}"`
        : result.error,
    });
  } catch (error) {
    console.error("Failed to update order:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders — Create a new donated bracelet order
 * Body: { heroName, recipientName, recipientEmail, quantity, quantity6, quantity7, source, notes, fulfillmentMethod, sku }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { heroName, recipientName } = body;

    if (!heroName || !recipientName) {
      return NextResponse.json(
        { error: "heroName and recipientName are required" },
        { status: 400 }
      );
    }

    const result = await createDonatedOrder(body);

    if (result.success) {
      await postToSlack(`\ud83c\udf81 New donated order: ${heroName} for ${recipientName} (${result.orderName})`);
    }

    return NextResponse.json({
      success: result.success,
      orderId: result.orderId,
      orderName: result.orderName,
      message: result.success
        ? `Donated order created for ${heroName}`
        : result.error,
    });
  } catch (error) {
    console.error("Failed to create order:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

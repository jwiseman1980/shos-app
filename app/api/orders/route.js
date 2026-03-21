import { NextResponse } from "next/server";
import { updateOrderStatus, createDonatedOrder } from "@/lib/data/orders";

/**
 * PATCH /api/orders — Update an order's status
 * Body: { pageId, status }
 */
export async function PATCH(request) {
  try {
    const { pageId, status } = await request.json();

    if (!pageId || !status) {
      return NextResponse.json(
        { error: "pageId and status are required" },
        { status: 400 }
      );
    }

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json({
        success: false,
        mock: true,
        message: "Notion not configured — status change not saved",
      });
    }

    await updateOrderStatus(pageId, status);

    return NextResponse.json({
      success: true,
      message: `Order status updated to "${status}"`,
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
 * Body: { heroName, recipientName, recipientEmail, quantity, quantity6, quantity7, source, notes, fulfillmentMethod }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { heroName, recipientName, quantity } = body;

    if (!heroName || !recipientName) {
      return NextResponse.json(
        { error: "heroName and recipientName are required" },
        { status: 400 }
      );
    }

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json({
        success: false,
        mock: true,
        message: "Notion not configured — order not created",
      });
    }

    const page = await createDonatedOrder(body);

    return NextResponse.json({
      success: true,
      orderId: page.id,
      message: `Donated order created for ${heroName}`,
    });
  } catch (error) {
    console.error("Failed to create order:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { createOrder } from "@/lib/shipstation";

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
  } catch (e) {
    console.warn("Slack post failed:", e.message);
  }
}

/**
 * POST /api/orders/push-shipstation
 * Body: { orderId }
 * Manually push a Supabase order to ShipStation. Works for donated AND paid orders.
 * (Paid Squarespace orders are usually already in ShipStation, but this allows a re-push.)
 */
export async function POST(request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const sb = getServerClient();

    const { data: order, error: orderErr } = await sb
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.shipping_address1 && !order.shipping_city) {
      return NextResponse.json({ error: "No shipping address — add address before pushing to ShipStation" }, { status: 422 });
    }

    const { data: allItems, error: itemsErr } = await sb
      .from("order_items")
      .select("id, lineitem_sku, quantity, unit_price, bracelet_size, production_status, hero:heroes!hero_id(name)")
      .eq("order_id", orderId);

    if (itemsErr) throw itemsErr;

    const shippableItems = (allItems || []).filter(
      (i) => i.production_status === "ready_to_ship" || i.production_status === "shipped"
    );

    if (shippableItems.length === 0) {
      return NextResponse.json({ error: "No items are ready to ship for this order" }, { status: 422 });
    }

    const orderName = order.order_number || `ORDER-${Date.now().toString().slice(-6)}`;
    const ssOrder = {
      orderNumber: orderName,
      orderDate: new Date().toISOString(),
      orderStatus: "awaiting_shipment",
      billTo: { name: "Steel Hearts", company: "Steel Hearts 501(c)(3)" },
      shipTo: {
        name: order.shipping_name || order.billing_name || "",
        street1: order.shipping_address1 || "",
        city: order.shipping_city || "",
        state: order.shipping_state || "",
        postalCode: order.shipping_postal || "",
        country: order.shipping_country || "US",
      },
      items: shippableItems.map((i) => ({
        sku: i.lineitem_sku || "",
        name: i.hero?.name || "Memorial Bracelet",
        quantity: i.quantity || 1,
        unitPrice: order.order_type === "paid" ? (i.unit_price || 35) : 0,
      })),
      customerEmail: order.billing_email || "",
      amountPaid: order.order_type === "donated" ? 0 : undefined,
      shippingAmount: 0,
      taxAmount: 0,
      internalNotes: `Manual push from SHOS app — ${order.order_type} order`,
    };

    const ssResult = await createOrder(ssOrder);

    if (!ssResult?.orderId) {
      return NextResponse.json({ error: "ShipStation push failed — check ShipStation credentials" }, { status: 502 });
    }

    await Promise.all([
      postToSlack(`🚀 *${orderName}* manually pushed to ShipStation (${shippableItems.length} item${shippableItems.length !== 1 ? "s" : ""})`, SLACK_WEBHOOK),
      postToSlack(`🚀 *${orderName}* pushed to ShipStation — ready to print label`, SLACK_DM_JOSEPH),
    ]);

    return NextResponse.json({ success: true, shipStationOrderId: ssResult.orderId, orderNumber: orderName });
  } catch (err) {
    console.error("Push to ShipStation error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

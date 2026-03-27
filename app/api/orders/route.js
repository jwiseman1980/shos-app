import { NextResponse } from "next/server";
import { updateItemStatus, createDonatedOrder, getActiveOrderItems, getOrderStats } from "@/lib/data/orders";
import { sfQuery } from "@/lib/salesforce";
import { createOrder } from "@/lib/shipstation";

const SLACK_WEBHOOK = process.env.SLACK_SOP_WEBHOOK;
// Per-person DM webhooks — notifications go to BOTH ops hub AND the person's DM
const SLACK_DM_JOSEPH = process.env.SLACK_DM_JOSEPH;
const SLACK_DM_RYAN = process.env.SLACK_DM_RYAN;
const SLACK_DM_KRISTIN = process.env.SLACK_DM_KRISTIN;

/**
 * When an item moves to Ready to Ship, check if ALL items in the parent order
 * are also Ready to Ship. If yes, auto-create a ShipStation order for donated orders.
 * (Paid Squarespace orders are already in ShipStation via direct integration.)
 */
async function autoPushToShipStation(itemId) {
  if (process.env.SF_LIVE !== "true") return;

  // Get the parent order for this item
  const items = await sfQuery(
    `SELECT Squarespace_Order__c FROM Squarespace_Order_Item__c WHERE Id = '${itemId}'`
  );
  if (items.length === 0) return;
  const orderId = items[0].Squarespace_Order__c;

  // Get the parent order details
  const orders = await sfQuery(
    `SELECT Id, Name, Order_Type__c, Shipping_Name__c, Shipping_Address1__c, Shipping_City__c,
            Shipping_State__c, Shipping_Postal__c, Shipping_Country__c, Billing_Email__c
     FROM Squarespace_Order__c WHERE Id = '${orderId}'`
  );
  if (orders.length === 0) return;
  const order = orders[0];

  // Only auto-push donated orders (paid orders already in ShipStation via Squarespace)
  if (order.Order_Type__c !== "Donated") return;

  // Check if ALL items in this order are Ready to Ship
  const allItems = await sfQuery(
    `SELECT Id, Name, Lineitem_sku__c, Quantity__c, Bracelet_Size__c, Production_Status__c
     FROM Squarespace_Order_Item__c WHERE Squarespace_Order__c = '${orderId}'`
  );
  const allReady = allItems.every(
    (i) => i.Production_Status__c === "Ready to Ship" || i.Production_Status__c === "Shipped"
  );
  if (!allReady) return;

  // Don't push if no shipping address
  if (!order.Shipping_Address1__c && !order.Shipping_City__c) {
    await postToSlack(`\u26a0\ufe0f ${order.Name} — all items ready but no shipping address. Add address to push to ShipStation.`);
    return;
  }

  // Build and push the ShipStation order
  const ssOrder = {
    orderNumber: order.Name,
    orderDate: new Date().toISOString(),
    orderStatus: "awaiting_shipment",
    billTo: { name: "Steel Hearts", company: "Steel Hearts 501(c)(3)" },
    shipTo: {
      name: order.Shipping_Name__c || "",
      street1: order.Shipping_Address1__c || "",
      city: order.Shipping_City__c || "",
      state: order.Shipping_State__c || "",
      postalCode: order.Shipping_Postal__c || "",
      country: order.Shipping_Country__c || "US",
    },
    items: allItems
      .filter((i) => i.Production_Status__c === "Ready to Ship")
      .map((i) => ({
        sku: i.Lineitem_sku__c || "",
        name: i.Name || "Memorial Bracelet",
        quantity: i.Quantity__c || 1,
        unitPrice: 0,
      })),
    customerEmail: order.Billing_Email__c || "",
    amountPaid: 0,
    shippingAmount: 0,
    taxAmount: 0,
    internalNotes: "Auto-pushed from SHOS app",
  };

  const ssResult = await createOrder(ssOrder);
  if (ssResult?.orderId) {
    await postToSlack(`\ud83d\ude80 ${order.Name} auto-pushed to ShipStation — ready to print label and ship!`);
  }
}

async function postToSlack(text, webhook = SLACK_WEBHOOK) {
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
 * Send to ops hub AND the person's DM so everyone sees progress
 * and the responsible person gets a direct ping.
 */
async function notifyPerson(text, dmWebhook) {
  await Promise.all([
    postToSlack(text),                       // ops hub — everyone sees the work getting done
    dmWebhook ? postToSlack(text, dmWebhook) // DM — direct ping to the person responsible
              : Promise.resolve(),
  ]);
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
        // Notify Joseph — he runs the laser
        await notifyPerson(`🔥 ${name} bracelet ready for laser production`, SLACK_DM_JOSEPH);
      } else if (status === "Design Needed") {
        // Notify Ryan — he creates designs
        await notifyPerson(`🎨 New design task: ${name} bracelet needs a design`, SLACK_DM_RYAN);
      } else if (status === "Ready to Ship") {
        // Notify Kristin — she handles shipping
        await notifyPerson(`📦 ${name} bracelet ready to ship`, SLACK_DM_KRISTIN);
        // Auto-push to ShipStation if ALL items in this order are now Ready to Ship
        try {
          await autoPushToShipStation(itemId);
        } catch (ssErr) {
          console.warn("ShipStation auto-push failed:", ssErr.message);
        }
      } else if (status === "Shipped") {
        await postToSlack(`✅ ${name} bracelet shipped`);
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
      await postToSlack(`🎁 New donated order: ${heroName} for ${recipientName} (${result.orderName})`);

      if (result.autoAdvanced) {
        // Design found, auto-advanced → notify Joseph for laser
        await notifyPerson(
          `🔥 ${heroName} bracelet auto-advanced to Ready to Laser (design found)`,
          SLACK_DM_JOSEPH
        );
      }
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

import { NextResponse } from "next/server";
import { updateItemStatus, createDonatedOrder, getActiveOrderItems, getOrderStats } from "@/lib/data/orders";
import { createOrder } from "@/lib/shipstation";
import { getServerClient } from "@/lib/supabase";
import { createGmailDraft } from "@/lib/gmail";
import { tryAdvanceWorkflow } from "@/lib/hero-workflow";
import {
  buildDesignNeededMessage,
  buildReadyToLaserMessage,
  buildReadyToShipMessage,
  buildShippedMessage,
  createActionUrl,
} from "@/lib/slack-actions";

// Map order_items.production_status → hero workflow stage that should be reached
// once the item enters that production status. Used by the orders PATCH handler
// to keep the hero pipeline in sync with production reality.
const PRODUCTION_TO_WORKFLOW = {
  ready_to_laser: "approved_production",
  in_production:  "lasering",
  ready_to_ship:  "photographing",
  shipped:        "shipped",
};

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
  const sb = getServerClient();

  // Get the parent order for this item
  const { data: item } = await sb
    .from("order_items")
    .select("order_id")
    .eq("id", itemId)
    .single();
  if (!item) return;

  // Get the parent order details
  const { data: order } = await sb
    .from("orders")
    .select("*")
    .eq("id", item.order_id)
    .single();
  if (!order) return;

  // Only auto-push donated orders (paid orders already in ShipStation via Squarespace)
  if (order.order_type !== "donated") return;

  // Check if ALL items in this order are Ready to Ship or Shipped
  const { data: allItems } = await sb
    .from("order_items")
    .select("id, lineitem_sku, quantity, bracelet_size, production_status, hero:heroes!hero_id(name)")
    .eq("order_id", item.order_id);

  const allReady = (allItems || []).every(
    (i) => i.production_status === "ready_to_ship" || i.production_status === "shipped"
  );
  if (!allReady) return;

  // Don't push if no shipping address
  if (!order.shipping_address1 && !order.shipping_city) {
    await postToSlack(`\u26a0\ufe0f ${order.order_number || "Donated order"} — all items ready but no shipping address. Add address to push to ShipStation.`);
    return;
  }

  // Build and push the ShipStation order
  const orderName = order.order_number || `DON-${Date.now()}`;
  const ssOrder = {
    orderNumber: orderName,
    orderDate: new Date().toISOString(),
    orderStatus: "awaiting_shipment",
    billTo: { name: "Steel Hearts", company: "Steel Hearts 501(c)(3)" },
    shipTo: {
      name: order.shipping_name || "",
      street1: order.shipping_address1 || "",
      city: order.shipping_city || "",
      state: order.shipping_state || "",
      postalCode: order.shipping_postal || "",
      country: order.shipping_country || "US",
    },
    items: (allItems || [])
      .filter((i) => i.production_status === "ready_to_ship")
      .map((i) => ({
        sku: i.lineitem_sku || "",
        name: i.hero?.name || "Memorial Bracelet",
        quantity: i.quantity || 1,
        unitPrice: 0,
      })),
    customerEmail: order.billing_email || "",
    amountPaid: 0,
    shippingAmount: 0,
    taxAmount: 0,
    internalNotes: "Auto-pushed from SHOS app",
  };

  const ssResult = await createOrder(ssOrder);
  if (ssResult?.orderId) {
    await postToSlack(`\ud83d\ude80 ${orderName} auto-pushed to ShipStation — ready to print label and ship!`);
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
 * Create a Gmail DRAFT for shipping notification (human reviews before sending).
 * Resolves hero name from Supabase rather than trusting the pass-through value,
 * and handles class bracelets and first-name parsing correctly.
 */
async function draftShippingEmail(itemId, fallbackName) {
  const sb = getServerClient();
  const { data: item } = await sb
    .from("order_items")
    .select(`
      hero:heroes!hero_id(name),
      order:orders!order_id(billing_email, billing_name, shipping_name)
    `)
    .eq("id", itemId)
    .single();

  const email = item?.order?.billing_email;
  if (!email) return;

  // Resolve hero name from the hero record, not the passed-in value (which can be a raw SKU)
  const heroName = item.hero?.name || fallbackName || "your hero";

  // Parse customer first name properly: "John Smith" -> "John", handle edge cases
  const fullName = (item.order.shipping_name || item.order.billing_name || "").trim();
  const firstName = fullName.split(/\s+/)[0].replace(/[,;]$/, "") || "there";

  // Avoid doubled "Memorial Bracelet" for class/event bracelets that already contain "Bracelet"
  const alreadyHasBracelet = /bracelet/i.test(heroName);
  const subject = alreadyHasBracelet
    ? `Shipped -- ${heroName}`
    : `Shipped -- ${heroName} Memorial Bracelet`;

  await createGmailDraft({
    senderEmail: "joseph.wiseman@steel-hearts.org",
    senderName: "Steel Hearts Foundation",
    to: email,
    subject,
    body: `Your bracelet is on its way, ${firstName}.\n\nThe memorial bracelet honoring ${heroName} has shipped. You should receive it within a few business days.\n\nThank you for carrying this name forward. Every bracelet is a promise that their sacrifice will not be forgotten.\n\nWith gratitude,\nJoseph Wiseman\nFounder, Steel Hearts Foundation\nsteel-hearts.org | EIN: 47-2511085`,
  });

  // Notify Joseph that a draft is waiting for review
  await postToSlack(
    `📧 *Shipping email draft created* for ${heroName} → ${email}\nReview in Gmail Drafts before sending. (ShipStation also sends its own tracking notification.)`,
    SLACK_DM_JOSEPH,
  );
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
      // Advance the hero pipeline alongside the order pipeline.
      // tryAdvanceWorkflow is best-effort and never moves backwards.
      const targetStage = PRODUCTION_TO_WORKFLOW[status];
      if (targetStage) {
        try {
          const sb = getServerClient();
          const { data: item } = await sb
            .from("order_items")
            .select("hero_id")
            .eq("id", itemId)
            .maybeSingle();
          if (item?.hero_id) {
            await tryAdvanceWorkflow(item.hero_id, targetStage);
          }
        } catch (wfErr) {
          console.warn("[orders.PATCH] workflow advance failed:", wfErr.message);
        }
      }

      const name = heroName || "Order item";
      if (status === "ready_to_laser") {
        // Notify Joseph with download + action links
        const msg = buildReadyToLaserMessage(name, heroName || "", null, [itemId]);
        await notifyPerson(msg, SLACK_DM_JOSEPH);
      } else if (status === "design_needed") {
        // Notify Ryan with upload link
        const msg = buildDesignNeededMessage(name, heroName || "", null, 1);
        await notifyPerson(msg, SLACK_DM_RYAN);
      } else if (status === "ready_to_ship") {
        // Decrement blank bracelet inventory (a blank was consumed during laser)
        try {
          const sb = getServerClient();
          const { data: item } = await sb
            .from("order_items")
            .select("lineitem_sku, quantity")
            .eq("id", itemId)
            .single();
          if (item) {
            const is6 = /-6D?$/i.test(item.lineitem_sku || "");
            const qty = item.quantity || 1;
            const field = is6 ? "decrement_6in" : "decrement_7in";
            await fetch(new URL("/api/inventory/blanks", request.url).href, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ [field]: qty }),
            });
          }
        } catch (blankErr) {
          console.warn("Blank stock decrement failed:", blankErr.message);
        }
        // Notify Kristin with ship action link
        const msg = buildReadyToShipMessage("", name, [itemId]);
        await notifyPerson(msg, SLACK_DM_KRISTIN);
        // Auto-push to ShipStation if ALL items in this order are now Ready to Ship
        try {
          await autoPushToShipStation(itemId);
        } catch (ssErr) {
          console.warn("ShipStation auto-push failed:", ssErr.message);
        }
      } else if (status === "shipped") {
        await postToSlack(buildShippedMessage(name));
        // Shipping email disabled — ShipStation handles customer notifications.
        // draftShippingEmail() is available when ready to build a branded follow-up.
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

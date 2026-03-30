/**
 * Squarespace Order Webhook → Supabase
 *
 * Receives order data from Zapier (or direct Squarespace webhook) and writes
 * directly to Supabase. This eliminates the 24-hour delay from the
 * Squarespace → Salesforce → nightly sync → Supabase pipeline.
 *
 * Zapier setup: Add a second action to the existing Squarespace → SF zap
 * that POSTs the same data to this endpoint with the webhook secret.
 *
 * Auth: WEBHOOK_SECRET header or query param
 */

import { getServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authenticate(request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;

  const header = request.headers.get("x-webhook-secret");
  const param = new URL(request.url).searchParams.get("secret");
  return header === secret || param === secret;
}

/**
 * Extract base SKU (no size/variant suffix).
 * ARMY-STEVENSON-7D → ARMY-STEVENSON
 */
function toBaseSku(sku) {
  if (!sku) return "";
  return sku
    .replace(/-[67]D$/i, "")
    .replace(/-[67]$/i, "")
    .replace(/-D$/i, "");
}

/**
 * Try to match a SKU to a hero in Supabase.
 */
async function findHeroBysku(sb, sku) {
  if (!sku) return null;
  const baseSku = toBaseSku(sku);
  if (!baseSku) return null;

  const { data } = await sb
    .from("heroes")
    .select("id")
    .ilike("lineitem_sku", baseSku)
    .limit(1)
    .single();

  return data?.id || null;
}

/**
 * Determine bracelet size from SKU.
 */
function sizeFromSku(sku) {
  if (!sku) return "Regular-7in";
  if (/-6D?$/i.test(sku)) return "Small-6in";
  return "Regular-7in";
}

export async function POST(request) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sb = getServerClient();

  try {
    // Normalize field names — Zapier may send Salesforce-style or Squarespace-style
    const orderNumber = body.orderNumber || body.order_number || body.Name || "";
    const orderDate = body.orderDate || body.order_date || body.Order_Date__c || new Date().toISOString().slice(0, 10);
    const billingName = body.billingName || body.billing_name || body.Billing_Name__c || "";
    const billingEmail = body.billingEmail || body.billing_email || body.Billing_Email__c || "";
    const shippingName = body.shippingName || body.shipping_name || body.Shipping_Name__c || "";
    const shippingAddress1 = body.shippingAddress1 || body.shipping_address1 || body.Shipping_Street__c || "";
    const shippingCity = body.shippingCity || body.shipping_city || body.Shipping_City__c || "";
    const shippingState = body.shippingState || body.shipping_state || body.Shipping_State__c || "";
    const shippingPostal = body.shippingPostal || body.shipping_postal || body.Shipping_Postal_Code__c || "";
    const shippingCountry = body.shippingCountry || body.shipping_country || body.Shipping_Country__c || "US";
    const orderType = body.orderType || body.order_type || "paid";
    const source = body.source || "squarespace";

    // Check for duplicate by order number
    if (orderNumber) {
      const { data: existing } = await sb
        .from("orders")
        .select("id")
        .eq("order_number", orderNumber)
        .limit(1)
        .single();

      if (existing) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          orderId: existing.id,
          message: `Order ${orderNumber} already exists`,
        });
      }
    }

    // Create order
    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert({
        order_number: orderNumber,
        order_date: orderDate,
        order_type: orderType,
        billing_name: billingName,
        billing_email: billingEmail,
        shipping_name: shippingName,
        shipping_address1: shippingAddress1,
        shipping_city: shippingCity,
        shipping_state: shippingState,
        shipping_postal: shippingPostal,
        shipping_country: shippingCountry,
        source,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;

    // Process line items
    const items = body.items || body.lineItems || [];
    const itemResults = [];

    for (const item of items) {
      const sku = item.sku || item.lineitem_sku || item.Lineitem_sku__c || "";
      const quantity = item.quantity || item.Quantity__c || 1;
      const unitPrice = item.unitPrice || item.unit_price || item.Unit_Price__c || 0;
      const heroId = await findHeroBysku(sb, sku);

      const { data: newItem, error: itemErr } = await sb
        .from("order_items")
        .insert({
          order_id: order.id,
          lineitem_sku: sku,
          quantity,
          unit_price: unitPrice,
          bracelet_size: sizeFromSku(sku),
          hero_id: heroId,
          production_status: "not_started",
        })
        .select("id")
        .single();

      if (itemErr) {
        console.error("Order item insert error:", itemErr.message);
        itemResults.push({ sku, error: itemErr.message });
      } else {
        itemResults.push({ sku, id: newItem.id, heroId });
      }
    }

    // If no items array was provided, check for single-item fields
    if (items.length === 0 && (body.sku || body.Lineitem_sku__c)) {
      const sku = body.sku || body.Lineitem_sku__c || "";
      const quantity = body.quantity || body.Quantity__c || 1;
      const unitPrice = body.unitPrice || body.Unit_Price__c || 0;
      const heroId = await findHeroBysku(sb, sku);

      const { data: newItem, error: itemErr } = await sb
        .from("order_items")
        .insert({
          order_id: order.id,
          lineitem_sku: sku,
          quantity,
          unit_price: unitPrice,
          bracelet_size: sizeFromSku(sku),
          hero_id: heroId,
          production_status: "not_started",
        })
        .select("id")
        .single();

      if (!itemErr) {
        itemResults.push({ sku, id: newItem.id, heroId });
      }
    }

    // Post to Slack if configured
    const slackWebhook = process.env.SLACK_SOP_WEBHOOK;
    if (slackWebhook) {
      try {
        await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🛒 New Squarespace order #${orderNumber}: ${itemResults.length} item(s) for ${billingName || shippingName || "unknown"}`,
          }),
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber,
      items: itemResults,
      message: `Order ${orderNumber} created with ${itemResults.length} item(s)`,
    });
  } catch (err) {
    console.error("Squarespace webhook error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

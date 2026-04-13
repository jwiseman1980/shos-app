/**
 * Squarespace Order Webhook → Supabase + ShipStation
 *
 * Receives Squarespace Commerce order.create webhooks, validates the
 * signature, normalizes the payload, and hands off to processIncomingOrder.
 *
 * Authentication:
 *   Squarespace signs every webhook with HMAC-SHA256 of the raw body,
 *   base64-encoded in the X-Squarespace-Hmac-SHA256 header.
 *   Secret is set when creating the webhook subscription in Squarespace →
 *   Commerce → Advanced → Webhooks. Store it as WEBHOOK_SECRET in Vercel.
 *
 *   Fallback: x-webhook-secret header or ?secret= query param (plain
 *   comparison) for internal calls / migration scripts.
 *
 * Adding Stripe later:
 *   Create app/api/webhooks/stripe/route.js, validate Stripe-Signature,
 *   map the Stripe payload to the same normalized shape, and call
 *   processIncomingOrder() from lib/data/processIncomingOrder.js.
 */

import crypto from "crypto";
import { processIncomingOrder } from "@/lib/data/processIncomingOrder";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── Signature validation ────────────────────────────────────────────────────

/**
 * Verify Squarespace's HMAC-SHA256 signature.
 * Header: X-Squarespace-Hmac-SHA256 = base64(HMAC-SHA256(rawBody, secret))
 */
function verifySquarespaceHmac(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");
    // Use timingSafeEqual to prevent timing attacks
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Authenticate the incoming request.
 * Accepts either Squarespace HMAC or a plain secret for internal callers.
 * Returns { ok: boolean, method: string }
 */
async function authenticate(request, rawBody) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return { ok: false, method: "no_secret_configured" };

  // 1. Squarespace HMAC (production path)
  const hmacHeader = request.headers.get("x-squarespace-hmac-sha256");
  if (hmacHeader) {
    const ok = verifySquarespaceHmac(rawBody, hmacHeader, secret);
    return { ok, method: "squarespace_hmac" };
  }

  // 2. Plain secret header (internal calls / migration scripts / testing)
  const plainHeader = request.headers.get("x-webhook-secret");
  if (plainHeader) {
    const ok = plainHeader === secret;
    return { ok, method: "plain_header" };
  }

  // 3. Query param (curl testing only — avoid in production)
  const paramSecret = new URL(request.url).searchParams.get("secret");
  if (paramSecret) {
    const ok = paramSecret === secret;
    return { ok, method: "query_param" };
  }

  return { ok: false, method: "no_auth_provided" };
}

// ── Payload normalization ───────────────────────────────────────────────────

/**
 * Map a Squarespace Commerce webhook payload to the normalized order shape
 * expected by processIncomingOrder.
 *
 * Squarespace sends:
 *   body.topic = "order.create"
 *   body.data.order.orderNumber
 *   body.data.order.billingAddress.{ firstName, lastName, address1, city, state, postalCode, countryCode }
 *   body.data.order.shippingAddress.{ ... }
 *   body.data.order.customerEmail
 *   body.data.order.lineItems[].{ sku, quantity, unitPricePaid.value, productName }
 *   body.data.order.createdOn
 *
 * Also handles flat formats sent by internal tools / migration scripts.
 */
function normalizePayload(body) {
  // ── Native Squarespace Commerce webhook format ──
  const sqOrder = body?.data?.order ?? body?.data ?? null;

  if (sqOrder?.lineItems || sqOrder?.billingAddress) {
    const bill = sqOrder.billingAddress ?? {};
    const ship = sqOrder.shippingAddress ?? bill; // fall back to billing if no shipping

    return {
      orderNumber: String(sqOrder.orderNumber ?? sqOrder.id ?? ""),
      orderDate: (sqOrder.createdOn ?? new Date().toISOString()).slice(0, 10),
      orderType: "paid",
      source: "squarespace",
      billingName: [bill.firstName, bill.lastName].filter(Boolean).join(" ").trim(),
      billingEmail: sqOrder.customerEmail ?? "",
      shippingName: [ship.firstName, ship.lastName].filter(Boolean).join(" ").trim(),
      shippingAddress1: ship.address1 ?? "",
      shippingCity: ship.city ?? "",
      shippingState: ship.state ?? "",
      shippingPostal: ship.postalCode ?? "",
      shippingCountry: ship.countryCode ?? "US",
      items: (sqOrder.lineItems ?? []).map((li) => ({
        sku: li.sku ?? "",
        quantity: li.quantity ?? 1,
        unitPrice: parseFloat(li.unitPricePaid?.value ?? li.unitPrice ?? 0),
        productName: li.productName ?? li.name ?? "",
      })),
      notes: sqOrder.customerMessage ?? sqOrder.notes ?? null,
    };
  }

  // ── Flat format (internal tools / Salesforce-style / legacy) ──
  const orderNumber = String(body.orderNumber ?? body.order_number ?? body.Name ?? "");
  const items = (() => {
    const arr = body.items ?? body.lineItems ?? [];
    if (arr.length > 0) {
      return arr.map((item) => ({
        sku: item.sku ?? item.lineitem_sku ?? item.Lineitem_sku__c ?? "",
        quantity: item.quantity ?? item.Quantity__c ?? 1,
        unitPrice: parseFloat(item.unitPrice ?? item.unit_price ?? item.Unit_Price__c ?? 0),
        productName: item.productName ?? item.name ?? "",
      }));
    }
    // Single-item flat fields
    if (body.sku || body.Lineitem_sku__c) {
      return [{
        sku: body.sku ?? body.Lineitem_sku__c ?? "",
        quantity: body.quantity ?? body.Quantity__c ?? 1,
        unitPrice: parseFloat(body.unitPrice ?? body.Unit_Price__c ?? 0),
        productName: "",
      }];
    }
    return [];
  })();

  return {
    orderNumber,
    orderDate: (body.orderDate ?? body.order_date ?? body.Order_Date__c ?? new Date().toISOString()).slice(0, 10),
    orderType: body.orderType ?? body.order_type ?? "paid",
    source: body.source ?? "squarespace",
    billingName: body.billingName ?? body.billing_name ?? body.Billing_Name__c ?? "",
    billingEmail: body.billingEmail ?? body.billing_email ?? body.Billing_Email__c ?? "",
    shippingName: body.shippingName ?? body.shipping_name ?? body.Shipping_Name__c ?? "",
    shippingAddress1: body.shippingAddress1 ?? body.shipping_address1 ?? body.Shipping_Street__c ?? "",
    shippingCity: body.shippingCity ?? body.shipping_city ?? body.Shipping_City__c ?? "",
    shippingState: body.shippingState ?? body.shipping_state ?? body.Shipping_State__c ?? "",
    shippingPostal: body.shippingPostal ?? body.shipping_postal ?? body.Shipping_Postal_Code__c ?? "",
    shippingCountry: body.shippingCountry ?? body.shipping_country ?? body.Shipping_Country__c ?? "US",
    items,
    notes: body.notes ?? null,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  // Read raw body FIRST — needed for HMAC, and body can only be read once
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body" }, { status: 400 });
  }

  // Authenticate
  const { ok, method } = await authenticate(request, rawBody);
  if (!ok) {
    console.warn(`[squarespace-webhook] Auth failed (method: ${method})`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse JSON
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only process order.create events; ACK everything else so Squarespace
  // doesn't retry non-order events (test pings, order.fulfill, etc.)
  const topic = body.topic ?? body.type ?? "";
  if (topic && topic !== "order.create" && !topic.startsWith("order")) {
    return NextResponse.json({ success: true, skipped: true, topic });
  }

  // Normalize payload
  const normalized = normalizePayload(body);

  // Process
  try {
    const result = await processIncomingOrder(normalized);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[squarespace-webhook] processIncomingOrder error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

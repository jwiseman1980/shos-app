import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { buildOutreachEmail } from "@/lib/email-templates";

/**
 * GET /api/messages/outreach?heroId=uuid
 * Preview mode: returns customer count + email preview HTML for review before sending.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const heroId = searchParams.get("heroId");

  if (!heroId) {
    return NextResponse.json({ error: "heroId required" }, { status: 400 });
  }

  const sb = getServerClient();

  const { data: hero } = await sb
    .from("heroes")
    .select("id, name, first_name, last_name, rank, lineitem_sku")
    .eq("id", heroId)
    .single();

  if (!hero || !hero.lineitem_sku) {
    return NextResponse.json({ customers: 0, emails: [] });
  }

  const { customers, emails } = await findBraceletCustomers(sb, hero.lineitem_sku);

  // Build email preview
  const heroSlug = hero.lineitem_sku.toLowerCase().replace(/_/g, "-");
  const heroFullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ");
  const heroFirstName = hero.first_name || hero.last_name || "this hero";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://steel-hearts.org";
  const bioPageUrl = `${siteUrl}/heroes/${heroSlug}`;

  const { subject, html } = buildOutreachEmail({
    heroFullName,
    heroFirstName,
    bioPageUrl,
    senderName: "Joseph Wiseman",
  });

  return NextResponse.json({
    customers,
    emails: emails.slice(0, 10), // Preview first 10 for UI
    subject,
    previewHtml: html,
    method: process.env.SENDGRID_API_KEY ? "sendgrid" : "gmail_draft",
  });
}

/**
 * POST /api/messages/outreach
 * Send mode: sends outreach emails to all bracelet customers.
 * Uses Resend (batch send) when configured, falls back to Gmail BCC draft.
 *
 * Body: {
 *   heroId: "uuid",
 *   senderEmail: "joseph@steel-hearts.org",
 *   senderName: "Joseph Wiseman"
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { heroId, senderEmail, senderName } = body;

    if (!heroId) {
      return NextResponse.json({ error: "heroId is required" }, { status: 400 });
    }
    if (!senderEmail || !senderEmail.endsWith("@steel-hearts.org")) {
      return NextResponse.json(
        { error: "senderEmail must be a @steel-hearts.org address" },
        { status: 400 }
      );
    }

    const sb = getServerClient();

    // 1. Get hero details
    const { data: hero, error: heroErr } = await sb
      .from("heroes")
      .select("id, name, first_name, last_name, rank, lineitem_sku, memorial_date, active_listing")
      .eq("id", heroId)
      .single();

    if (heroErr || !hero) {
      return NextResponse.json({ error: "Hero not found" }, { status: 404 });
    }

    const heroSlug = (hero.lineitem_sku || hero.last_name || "")
      .toLowerCase()
      .replace(/_/g, "-");
    const heroFullName = [hero.rank, hero.first_name, hero.last_name]
      .filter(Boolean)
      .join(" ");
    const heroFirstName = hero.first_name || hero.last_name || "this hero";
    const baseSku = hero.lineitem_sku;

    if (!baseSku) {
      return NextResponse.json({ error: "Hero has no SKU" }, { status: 400 });
    }

    // 2. Find all bracelet customers
    const { customers, emails } = await findBraceletCustomers(sb, baseSku);

    if (customers === 0) {
      return NextResponse.json({
        success: true,
        customersFound: 0,
        heroName: heroFullName,
        message: "No customers found for this hero's bracelet",
      });
    }

    // 3. Build email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://steel-hearts.org";
    const bioPageUrl = `${siteUrl}/heroes/${heroSlug}`;

    const { html, plainText, subject } = buildOutreachEmail({
      heroFullName,
      heroFirstName,
      bioPageUrl,
      senderName: senderName || "Joseph Wiseman",
    });

    // 4. Send via Resend (preferred) or fall back to Gmail draft
    let result;

    if (process.env.SENDGRID_API_KEY) {
      result = await sendViaSendGrid({ emails, subject, html, plainText, senderName });
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      result = await sendViaGmailDraft({ emails, subject, html, plainText, senderEmail, senderName });
    } else {
      return NextResponse.json({
        success: false,
        mock: true,
        customersFound: customers,
        heroName: heroFullName,
        message: "No email service configured (need SENDGRID_API_KEY or Gmail service account)",
      });
    }

    // 5. Log outreach
    await sb.from("engagement_log").insert({
      type: "message_outreach",
      hero_id: heroId,
      description: `Outreach ${result.method}: ${result.sent || result.customers} emails for ${heroFullName}`,
      metadata: {
        customersFound: customers,
        method: result.method,
        sent: result.sent,
        failed: result.failed,
        source: "manual",
      },
    }).then(() => {}).catch(() => {});

    return NextResponse.json({
      success: true,
      customersFound: customers,
      heroName: heroFullName,
      method: result.method,
      ...result,
    });
  } catch (error) {
    console.error("Message outreach failed:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findBraceletCustomers(sb, baseSku) {
  const { data: orderItems } = await sb
    .from("order_items")
    .select("order_id")
    .or(`lineitem_sku.eq.${baseSku}-7,lineitem_sku.eq.${baseSku}-6,lineitem_sku.eq.${baseSku}-7D,lineitem_sku.eq.${baseSku}-6D`);

  if (!orderItems || orderItems.length === 0) {
    return { customers: 0, emails: [] };
  }

  const orderIds = [...new Set(orderItems.map((oi) => oi.order_id))];
  const { data: orders } = await sb
    .from("orders")
    .select("billing_name, billing_email")
    .in("id", orderIds)
    .not("billing_email", "is", null);

  const customerMap = {};
  for (const order of orders || []) {
    const email = order.billing_email?.toLowerCase().trim();
    if (email && !customerMap[email]) {
      customerMap[email] = { email, name: order.billing_name || "Friend" };
    }
  }

  const emailList = Object.values(customerMap);
  return { customers: emailList.length, emails: emailList };
}

async function sendViaSendGrid({ emails, subject, html, plainText, senderName }) {
  const { sendToMany } = await import("@/lib/sendgrid");

  const recipients = emails.map((c) => c.email);

  const { sent, failed, errors } = await sendToMany({
    recipients,
    subject,
    html,
    text: plainText,
    fromName: senderName || "Steel Hearts Foundation",
    fromEmail: "hello@steel-hearts.org",
    categories: ["outreach", "tribute-request"],
  });

  return {
    method: "sendgrid",
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
    message: `Sent ${sent} emails via SendGrid${failed > 0 ? ` (${failed} failed)` : ""}`,
  };
}

async function sendViaGmailDraft({ emails, subject, html, plainText, senderEmail, senderName }) {
  const { createGmailDraft } = await import("@/lib/gmail");

  const bccList = emails.map((c) => c.email).join(", ");

  const draft = await createGmailDraft({
    senderEmail,
    senderName: senderName || "Steel Hearts Foundation",
    to: senderEmail,
    subject,
    body: plainText,
    html,
    bcc: bccList,
  });

  return {
    method: "gmail_draft",
    draftId: draft.draftId,
    customers: emails.length,
    message: `Draft created in ${senderEmail} inbox — ${emails.length} customers BCC'd. Review and send.`,
  };
}

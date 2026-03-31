/**
 * Anniversary Outreach Cron
 *
 * Runs daily at 11:30 AM UTC. Finds heroes with anniversaries ~14 days out.
 * Sends outreach emails to all bracelet customers encouraging them to leave
 * a tribute message on the hero's bio page.
 *
 * Uses Resend (batch send) when configured, falls back to Gmail BCC draft.
 * Posts summary to Slack.
 */

import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { postToSlack } from "@/lib/slack";
import { buildOutreachEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  // Auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = new URL(request.url).searchParams.get("key") || request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sb = getServerClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://steel-hearts.org";
    const senderName = "Joseph Wiseman";

    // Find heroes with anniversaries in 14 days (+/- 1 day buffer)
    const now = new Date();
    const targets = [13, 14, 15].map((offset) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return { month: d.getMonth() + 1, day: d.getDate() };
    });

    const { data: allHeroes, error: heroErr } = await sb
      .from("heroes")
      .select("id, name, first_name, last_name, rank, lineitem_sku, memorial_month, memorial_day, active_listing")
      .eq("active_listing", true);

    if (heroErr) {
      return NextResponse.json({ error: heroErr.message }, { status: 500 });
    }

    const matchedHeroes = (allHeroes || []).filter((h) => {
      const m = Number(h.memorial_month);
      const d = Number(h.memorial_day);
      if (!m || !d) return false;
      return targets.some((t) => t.month === m && t.day === d);
    });

    if (matchedHeroes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No anniversaries in 14-day window",
        heroesChecked: allHeroes?.length || 0,
      });
    }

    // Determine send method
    const useSendGrid = Boolean(process.env.SENDGRID_API_KEY);
    const useGmail = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    if (!useSendGrid && !useGmail) {
      return NextResponse.json({
        success: false,
        mock: true,
        matchedHeroes: matchedHeroes.map((h) => h.name),
        message: "No email service configured",
      });
    }

    const results = [];

    for (const hero of matchedHeroes) {
      const baseSku = hero.lineitem_sku;
      if (!baseSku) {
        results.push({ hero: hero.name, status: "skipped", reason: "no SKU" });
        continue;
      }

      const heroSlug = baseSku.toLowerCase().replace(/_/g, "-");
      const heroFullName = [hero.rank, hero.first_name, hero.last_name].filter(Boolean).join(" ");
      const heroFirstName = hero.first_name || hero.last_name || "this hero";
      const bioPageUrl = `${siteUrl}/heroes/${heroSlug}`;

      // Find bracelet customers
      const { data: orderItems } = await sb
        .from("order_items")
        .select("order_id")
        .or(`lineitem_sku.eq.${baseSku}-7,lineitem_sku.eq.${baseSku}-6,lineitem_sku.eq.${baseSku}-7D,lineitem_sku.eq.${baseSku}-6D`);

      if (!orderItems || orderItems.length === 0) {
        results.push({ hero: hero.name, status: "skipped", reason: "no orders" });
        continue;
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

      const customers = Object.values(customerMap);
      if (customers.length === 0) {
        results.push({ hero: hero.name, status: "skipped", reason: "no customer emails" });
        continue;
      }

      // Build email
      const { html, plainText, subject } = buildOutreachEmail({
        heroFullName,
        heroFirstName,
        bioPageUrl,
        senderName,
      });

      // Send
      try {
        if (useSendGrid) {
          const { sendToMany } = await import("@/lib/sendgrid");

          const recipients = customers.map((c) => c.email);

          const { sent, failed } = await sendToMany({
            recipients,
            subject,
            html,
            text: plainText,
            fromName: "Steel Hearts Foundation",
            fromEmail: "hello@steel-hearts.org",
            categories: ["anniversary-outreach", "tribute-request"],
          });

          results.push({
            hero: hero.name,
            status: "sent",
            method: "sendgrid",
            sent,
            failed,
            customers: customers.length,
          });
        } else {
          const { createGmailDraft } = await import("@/lib/gmail");
          const bccList = customers.map((c) => c.email).join(", ");

          const draft = await createGmailDraft({
            senderEmail: "joseph.wiseman@steel-hearts.org",
            senderName: "Steel Hearts Foundation",
            to: "joseph.wiseman@steel-hearts.org",
            subject,
            body: plainText,
            html,
            bcc: bccList,
          });

          results.push({
            hero: hero.name,
            status: "draft_created",
            method: "gmail",
            customers: customers.length,
            draftId: draft.draftId,
          });
        }

        // Log
        await sb.from("engagement_log").insert({
          type: "message_outreach",
          hero_id: hero.id,
          description: `Anniversary outreach: ${customers.length} customers for ${heroFullName}`,
          metadata: { customers: customers.length, source: "cron", method: useSendGrid ? "sendgrid" : "gmail" },
        }).catch(() => {});
      } catch (err) {
        results.push({ hero: hero.name, status: "error", error: err.message });
      }
    }

    // Slack summary
    const successful = results.filter((r) => r.status === "sent" || r.status === "draft_created");
    if (successful.length > 0) {
      const summary = successful
        .map((r) => `• ${r.hero}: ${r.customers} customers (${r.method})`)
        .join("\n");

      const action = useSendGrid ? "Emails sent via SendGrid." : "Drafts in Joseph's Gmail — review and send.";

      await postToSlack(
        `📬 *Anniversary Message Outreach*\n\n${summary}\n\n${action}`,
        process.env.SLACK_DM_JOSEPH
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      matchedHeroes: matchedHeroes.length,
      method: useSendGrid ? "sendgrid" : "gmail",
      results,
    });
  } catch (error) {
    console.error("Anniversary outreach cron failed:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

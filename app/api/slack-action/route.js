import { NextResponse } from "next/server";
import { verifyActionUrl, notifyWithDm } from "@/lib/slack-actions";
import { updateItemStatus } from "@/lib/data/orders";
import { getServerClient } from "@/lib/supabase";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shos-app.vercel.app";

/**
 * GET /api/slack-action — Execute a signed action from a Slack message link.
 *
 * Validates HMAC signature + expiration, executes the action, then redirects
 * to a success page or the relevant app page.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const params = verifyActionUrl(searchParams);

  if (!params) {
    return new Response(buildHtml("Link Expired or Invalid", "This action link has expired or is invalid. Please use the SHOS app directly."), {
      status: 403,
      headers: { "Content-Type": "text/html" },
    });
  }

  const { action } = params;

  try {
    if (action === "advance_order") {
      return await handleAdvanceOrder(params);
    }

    if (action === "create_draft") {
      return await handleCreateDraft(params);
    }

    if (action === "mark_sent") {
      return await handleMarkSent(params);
    }

    return new Response(buildHtml("Unknown Action", `Action "${action}" is not recognized.`), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Slack action error:", error.message);
    return new Response(buildHtml("Error", `Something went wrong: ${error.message}`), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}

// ---------------------------------------------------------------------------
// Action Handlers
// ---------------------------------------------------------------------------

async function handleAdvanceOrder(params) {
  const { items, to, name } = params;
  if (!items || !to) {
    return new Response(buildHtml("Missing Parameters", "Item IDs and target status are required."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const itemIds = items.split(",").filter(Boolean);
  let updated = 0;

  for (const id of itemIds) {
    const result = await updateItemStatus(id, to);
    if (result.success) updated++;
  }

  // Trigger downstream Slack notifications via the orders API
  // (the PATCH handler in /api/orders already does this, but we called updateItemStatus directly)
  // Post a confirmation instead
  const statusLabels = {
    in_production: "laser started",
    ready_to_ship: "ready to ship",
    shipped: "shipped",
    ready_to_laser: "ready to laser",
  };
  const label = statusLabels[to] || to;

  // Notify appropriate person for next stage
  if (to === "in_production") {
    // Joseph started laser — no notification needed (he clicked the link)
  } else if (to === "ready_to_ship") {
    // Laser done → notify Kristin
    const kristinDm = process.env.SLACK_DM_KRISTIN;
    if (kristinDm) {
      const { buildReadyToShipMessage } = await import("@/lib/slack-actions");
      // We'd need order info here — keep it simple for now
      await notifyWithDm(`📦 *${name || "Order"}* ready to ship`, kristinDm);
    }
  } else if (to === "shipped") {
    await notifyWithDm(`✅ *${name || "Order"}* shipped`, null);
  }

  return new Response(buildHtml(
    "Done",
    `${updated} item${updated !== 1 ? "s" : ""} advanced to *${label}*.`,
    APP_URL + "/production",
  ), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

async function handleCreateDraft(params) {
  const { hero: heroId, name } = params;
  if (!heroId) {
    return new Response(buildHtml("Missing Parameters", "Hero ID is required."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Redirect to the app's anniversary page with the hero pre-selected
  // The actual draft creation happens through the existing UI
  return Response.redirect(`${APP_URL}/anniversaries?create_draft=${heroId}`, 302);
}

async function handleMarkSent(params) {
  const { hero: heroId, name, volunteer } = params;
  if (!heroId) {
    return new Response(buildHtml("Missing Parameters", "Hero ID is required."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const sb = getServerClient();
  const { error } = await sb
    .from("heroes")
    .update({
      anniversary_status: "sent",
      anniversary_completed_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", heroId);

  if (error) {
    return new Response(buildHtml("Error", `Failed to update: ${error.message}`), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Notify ops + anniversary channel
  const anniversaryChannel = process.env.SLACK_ANNIVERSARY_CHANNEL;
  const opsChannel = process.env.SLACK_SOP_WEBHOOK;
  const msg = `✅ *${volunteer || "Volunteer"}* marked remembrance email sent for *${name || "Hero"}*`;
  await Promise.all([
    opsChannel ? notifyWithDm(msg, null) : Promise.resolve(),
    anniversaryChannel ? (await import("@/lib/slack-actions")).postWebhook(anniversaryChannel, msg) : Promise.resolve(),
  ]);

  return new Response(buildHtml(
    "Done",
    `Remembrance email for ${name || "hero"} marked as sent.`,
    APP_URL + "/anniversaries",
  ), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

// ---------------------------------------------------------------------------
// HTML Response Builder
// ---------------------------------------------------------------------------

function buildHtml(title, message, redirectUrl) {
  const redirect = redirectUrl
    ? `<meta http-equiv="refresh" content="2;url=${redirectUrl}">`
    : "";
  const link = redirectUrl
    ? `<p style="margin-top:16px"><a href="${redirectUrl}" style="color:#c4a237">Open SHOS App</a></p>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title} — SHOS</title>${redirect}
<style>
  body { background: #0e0e12; color: #e8eaed; font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
  .card { background: #141418; border: 1px solid rgba(176,184,196,0.08); border-radius: 12px; padding: 32px; max-width: 400px; text-align: center; }
  h1 { color: #c4a237; font-size: 20px; margin: 0 0 12px; }
  p { color: #c8ccd3; font-size: 14px; line-height: 1.6; margin: 0; }
  a { text-decoration: none; }
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p>${link}</div></body></html>`;
}

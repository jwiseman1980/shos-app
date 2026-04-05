import { NextResponse } from "next/server";
import { verifyActionUrl, notifyWithDm, sendSlackDm, buildDesignQueueMessage, buildDesignUploadedMessage } from "@/lib/slack-actions";
import { updateItemStatus } from "@/lib/data/orders";
import { getServerClient } from "@/lib/supabase";
import { getOrderDesignQueue } from "@/lib/data/designs";

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
    return new Response(buildHtml(
      "Link Expired",
      "This action link has expired (links are valid for 7 days). Go to the SHOS app to take this action directly.",
      APP_URL + "/anniversaries",
    ), {
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

    if (action === "mark_scheduled") {
      return await handleMarkScheduled(params);
    }

    if (action === "upload_design_page") {
      return await handleUploadDesignPage(params);
    }

    if (action === "view_design_queue") {
      return await handleViewDesignQueue();
    }

    return new Response(buildHtml("Unknown Action", `Action "${action}" is not recognized.`), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Slack action error:", error.message);
    return new Response(buildHtml(
      "Something Went Wrong",
      `There was an error processing this action. Try again or use the SHOS app directly. If this keeps happening, let Joseph know.`,
      APP_URL,
    ), {
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

  // Decrement blank stock when laser is done (ready_to_ship)
  if (to === "ready_to_ship") {
    try {
      const sb = getServerClient();
      for (const id of itemIds) {
        const { data: item } = await sb
          .from("order_items")
          .select("lineitem_sku, quantity")
          .eq("id", id)
          .single();
        if (item) {
          const is6 = /-6D?$/i.test(item.lineitem_sku || "");
          const qty = item.quantity || 1;
          const current = await (await fetch(`${APP_URL}/api/inventory/blanks`)).json();
          const field = is6 ? "blanks_6in" : "blanks_7in";
          const newVal = Math.max(0, (current[field] || 0) - qty);
          await fetch(`${APP_URL}/api/inventory/blanks`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: newVal }),
          });
        }
      }
    } catch (blankErr) {
      console.warn("Blank stock decrement failed:", blankErr.message);
    }
  }

  const statusLabels = {
    in_production: "laser started",
    ready_to_ship: "ready to ship",
    shipped: "shipped",
    ready_to_laser: "ready to laser",
  };
  const label = statusLabels[to] || to;

  // Notify appropriate person for next stage
  if (to === "ready_to_ship") {
    // Laser done → notify Kristin
    const kristinDm = process.env.SLACK_DM_KRISTIN;
    await notifyWithDm(`📦 *${name || "Order"}* ready to ship`, kristinDm);
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
  const { hero: heroId, name, volunteer } = params;
  if (!heroId) {
    return new Response(buildHtml("Missing Parameters", "Hero ID is required."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Look up hero + assigned volunteer from Supabase to get all required fields
  try {
    const sb = getServerClient();
    const { data: hero, error: heroErr } = await sb
      .from("heroes")
      .select(`
        id, sf_id, name, rank, branch, memorial_date, memorial_month, memorial_day,
        anniversary_assigned_to,
        family_contact:contacts!family_contact_id(first_name, last_name, email),
        assigned_user:users!anniversary_assigned_to(name, email)
      `)
      .eq("id", heroId)
      .single();

    if (heroErr || !hero) {
      return new Response(buildHtml("Hero Not Found", `Could not find hero record for ID: ${heroId}`), {
        status: 404,
        headers: { "Content-Type": "text/html" },
      });
    }

    const familyEmail = hero.family_contact?.email;
    if (!familyEmail) {
      const familyName = hero.family_contact
        ? `${hero.family_contact.first_name || ""} ${hero.family_contact.last_name || ""}`.trim()
        : null;
      const detail = familyName
        ? `We have a family contact (${familyName}) but no email address on file.`
        : `No family contact is linked to this hero record.`;
      return new Response(buildHtml(
        "Family Email Needed",
        `${detail} An email address is required to create the anniversary draft for ${hero.name}. Please ask Joseph or check the Families page in the app to add it.`,
        `${APP_URL}/families`,
      ), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    const senderEmail = hero.assigned_user?.email;
    const senderName = hero.assigned_user?.name;
    if (!senderEmail) {
      return new Response(buildHtml(
        "No Volunteer Assigned",
        `No volunteer is assigned to ${hero.name}'s anniversary email. Please assign a volunteer in the app first.`,
        `${APP_URL}/anniversaries`,
      ), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Calculate years since passing
    const now = new Date();
    const memDate = hero.memorial_date ? new Date(hero.memorial_date) : null;
    const years = memDate ? now.getFullYear() - memDate.getFullYear() : null;

    const familyName = hero.family_contact
      ? `${hero.family_contact.first_name || ""} ${hero.family_contact.last_name || ""}`.trim() || "Family"
      : "Family";

    const draftRes = await fetch(`${APP_URL}/api/anniversaries/draft-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.SHOS_API_KEY || "",
      },
      body: JSON.stringify({
        heroName: hero.name,
        branch: hero.branch,
        years,
        memorialDate: hero.memorial_date,
        familyEmail,
        familyName,
        senderEmail,
        senderName,
        sfId: hero.sf_id || hero.id,
      }),
    });

    if (draftRes.ok) {
      return new Response(buildHtml(
        "Draft Created",
        `A Gmail draft has been created in ${senderEmail} for ${hero.name}'s remembrance email. Open Gmail to review, edit, and send (or schedule send for the anniversary date).`,
        "https://mail.google.com",
      ), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    const errData = await draftRes.json().catch(() => ({}));
    return new Response(buildHtml(
      "Draft Failed",
      `Could not create draft: ${errData.error || "Unknown error"}. Try using the app directly.`,
      `${APP_URL}/anniversaries`,
    ), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("[slack-action] create_draft error:", err.message);
    // Fallback: redirect to the app's anniversary page
    return Response.redirect(`${APP_URL}/anniversaries?create_draft=${heroId}`, 302);
  }
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

async function handleMarkScheduled(params) {
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
      anniversary_status: "scheduled",
      updated_at: new Date().toISOString(),
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
  const msg = `📅 *${volunteer || "Volunteer"}* scheduled remembrance email for *${name || "Hero"}* — will send on the anniversary date`;
  await Promise.all([
    notifyWithDm(msg, null),
    anniversaryChannel ? (await import("@/lib/slack-actions")).postWebhook(anniversaryChannel, msg) : Promise.resolve(),
  ]);

  return new Response(buildHtml(
    "Scheduled",
    `Remembrance email for ${name || "hero"} marked as scheduled. It will send automatically on the anniversary date via Gmail.`,
    APP_URL + "/anniversaries",
  ), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

// ---------------------------------------------------------------------------
// Design Queue Actions (Ryan's Slack-first workflow)
// ---------------------------------------------------------------------------

async function handleUploadDesignPage(params) {
  const { sku, name } = params;
  // Redirect Ryan to the upload page in the app with SKU pre-filled
  const uploadUrl = `${APP_URL}/designs?upload=${encodeURIComponent(sku || "")}`;
  return new Response(buildHtml(
    "Upload Design",
    `Upload the completed SVG design for ${name || sku || "this hero"}.`,
    uploadUrl,
  ), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

async function handleViewDesignQueue() {
  // Build a fresh queue summary and redirect to the app
  try {
    const queue = await getOrderDesignQueue();
    const items = queue.filter(q => !q.hasDesign).map(q => ({
      sku: q.sku,
      heroName: q.heroName,
      size: q.size,
      heroId: q.heroId,
      orderCount: 1,
    }));

    // Also DM Ryan the queue summary
    const msg = buildDesignQueueMessage(items);
    await sendSlackDm("ryan.santana@steel-hearts.org", msg);
  } catch {
    // Best effort
  }

  return Response.redirect(`${APP_URL}/designs`, 302);
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

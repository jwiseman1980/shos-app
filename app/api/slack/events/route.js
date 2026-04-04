import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerClient } from "@/lib/supabase";

/**
 * POST /api/slack/events — Slack Events API endpoint.
 *
 * Handles:
 * 1. URL verification challenge (Slack app setup)
 * 2. Message events from DMs to the bot
 *
 * When a user messages the bot, this endpoint:
 * - Parses the question
 * - Queries Supabase for relevant data
 * - Responds in the same DM thread
 */

const BOT_TOKEN = () => process.env.SLACK_BOT_TOKEN;
const SIGNING_SECRET = () => process.env.SLACK_SIGNING_SECRET;

// Verify Slack request signature
function verifySlackSignature(body, timestamp, signature) {
  const secret = SIGNING_SECRET();
  if (!secret) return true; // Skip verification if no secret configured (dev mode)

  const fiveMinAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinAgo) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = "v0=" + crypto.createHmac("sha256", secret).update(sigBasestring).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

// Post a reply to Slack
async function reply(channel, text, threadTs) {
  const token = BOT_TOKEN();
  if (!token) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      thread_ts: threadTs || undefined,
      mrkdwn: true,
    }),
  });
}

// Handle user questions about their tasks
async function handleMessage(event) {
  const { text, user, channel, ts } = event;
  const msg = (text || "").toLowerCase().trim();

  const sb = getServerClient();

  // Find the user by Slack ID
  const { data: dbUser } = await sb
    .from("users")
    .select("id, name, email")
    .eq("slack_user_id", user)
    .single();

  if (!dbUser) {
    await reply(channel, "I don't have you linked in the system yet. Ask Joseph to set up your user record.", ts);
    return;
  }

  // Anniversary email queries
  if (msg.includes("anniversary") || msg.includes("email") || msg.includes("queue") || msg.includes("what do i") || msg.includes("what's") || msg.includes("tasks") || msg.includes("to do") || msg.includes("assigned") || msg.includes("pending")) {
    const { data: heroes, error } = await sb
      .from("heroes")
      .select(`
        id, name, rank, branch, memorial_date, memorial_month, memorial_day,
        anniversary_status,
        family_contact:contacts!family_contact_id(first_name, last_name, email)
      `)
      .eq("anniversary_assigned_to", dbUser.id)
      .not("anniversary_status", "in", "(sent,scheduled)")
      .order("memorial_month", { ascending: true })
      .order("memorial_day", { ascending: true });

    if (error) {
      await reply(channel, `Something went wrong querying your tasks: ${error.message}`, ts);
      return;
    }

    if (!heroes || heroes.length === 0) {
      await reply(channel, `You're all caught up, ${dbUser.name.split(" ")[0]}! No pending anniversary emails right now.`, ts);
      return;
    }

    // Build response with action links
    const { buildAnniversaryAssignedMessage } = await import("@/lib/slack-actions");

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const overdue = heroes.filter(h =>
      h.memorial_month < currentMonth ||
      (h.memorial_month === currentMonth && h.memorial_day < currentDay)
    );
    const upcoming = heroes.filter(h =>
      h.memorial_month > currentMonth ||
      (h.memorial_month === currentMonth && h.memorial_day >= currentDay)
    );

    const lines = [`Hey ${dbUser.name.split(" ")[0]}! Here are your pending anniversary emails (${heroes.length} total):\n`];

    if (overdue.length > 0) {
      lines.push(`🚨 *OVERDUE (${overdue.length})*\n`);
      for (const h of overdue) {
        const familyContact = h.family_contact?.email
          ? `${h.family_contact.first_name || ""} ${h.family_contact.last_name || ""}`.trim() + ` (${h.family_contact.email})`
          : "⚠️ No family email on file";
        lines.push(buildAnniversaryAssignedMessage(h.name, h.memorial_date, familyContact, h.id, dbUser.name));
        lines.push("");
      }
    }

    if (upcoming.length > 0) {
      lines.push(`\n📅 *UPCOMING (${upcoming.length})*\n`);
      for (const h of upcoming) {
        const familyContact = h.family_contact?.email
          ? `${h.family_contact.first_name || ""} ${h.family_contact.last_name || ""}`.trim() + ` (${h.family_contact.email})`
          : "⚠️ No family email on file";
        lines.push(buildAnniversaryAssignedMessage(h.name, h.memorial_date, familyContact, h.id, dbUser.name));
        lines.push("");
      }
    }

    await reply(channel, lines.join("\n"), ts);
    return;
  }

  // Design queue queries (for Ryan)
  if (msg.includes("design") || msg.includes("svg") || msg.includes("bracelet") && (msg.includes("queue") || msg.includes("need") || msg.includes("what"))) {
    const { data: designs } = await sb
      .from("heroes")
      .select("id, name, lineitem_sku, design_status, design_brief")
      .in("design_status", ["research", "in_progress", "review"])
      .order("created_at", { ascending: false });

    if (!designs || designs.length === 0) {
      await reply(channel, "Design queue is clear! No pending designs right now.", ts);
      return;
    }

    const lines = [`📋 *Design Queue* (${designs.length} pending)\n`];
    for (const d of designs) {
      lines.push(`• \`${d.lineitem_sku || "no SKU"}\` *${d.name}* — ${d.design_status}`);
      if (d.design_brief) lines.push(`  _${d.design_brief.slice(0, 100)}_`);
    }

    await reply(channel, lines.join("\n"), ts);
    return;
  }

  // Help / catch-all
  await reply(channel, [
    `Hey ${dbUser.name.split(" ")[0]}! Here's what you can ask me:`,
    "",
    "• *\"What are my anniversary emails?\"* — see your pending tasks with Create Draft links",
    "• *\"What's in the design queue?\"* — see pending bracelet designs",
    "• *\"What do I need to do?\"* — see all your assigned tasks",
    "",
    "_More capabilities coming soon!_",
  ].join("\n"), ts);
}

export async function POST(request) {
  const rawBody = await request.text();

  // Verify signature
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  if (SIGNING_SECRET() && !verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // URL verification challenge (Slack app setup)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Event callback
  if (body.type === "event_callback") {
    const event = body.event;

    // Only handle direct messages to the bot (ignore bot's own messages)
    if (event.type === "message" && !event.bot_id && !event.subtype) {
      // Process async so we respond within 3 seconds
      handleMessage(event).catch((err) => {
        console.error("[slack/events] handleMessage error:", err.message);
      });
    }
  }

  // Always respond 200 quickly to avoid Slack retries
  return NextResponse.json({ ok: true });
}

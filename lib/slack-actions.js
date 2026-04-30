import crypto from "crypto";
import { getServerClient } from "@/lib/supabase";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shos-app.vercel.app";
const SECRET = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is required");
  return s;
};

// Legacy webhook lookup — fallback if no SLACK_BOT_TOKEN
// Maps both full-name and short-alias emails to the same webhook
const LEGACY_WEBHOOK_DMS = {
  "joseph.wiseman@steel-hearts.org": () => process.env.SLACK_DM_JOSEPH,
  "ryan.santana@steel-hearts.org": () => process.env.SLACK_DM_RYAN,
  "ryan@steel-hearts.org": () => process.env.SLACK_DM_RYAN,
  "kristin.hughes@steel-hearts.org": () => process.env.SLACK_DM_KRISTIN,
  "kristin@steel-hearts.org": () => process.env.SLACK_DM_KRISTIN,
  "chris.marti@steel-hearts.org": () => process.env.SLACK_DM_CHRIS,
  "chris@steel-hearts.org": () => process.env.SLACK_DM_CHRIS,
};

// ---------------------------------------------------------------------------
// Signed Action URLs
// ---------------------------------------------------------------------------

/**
 * Create a signed action URL that can be clicked from Slack.
 * Expires after `ttlHours` (default 24h).
 */
export function createActionUrl(action, params = {}, ttlHours = 168) { // 7 days default
  const exp = Math.floor(Date.now() / 1000) + ttlHours * 3600;
  const qs = new URLSearchParams({ action, ...params, exp: String(exp) });
  const payload = qs.toString();
  const sig = crypto.createHmac("sha256", SECRET()).update(payload).digest("hex");
  qs.set("sig", sig);
  return `${APP_URL}/api/slack-action?${qs.toString()}`;
}

/**
 * Verify a signed action URL. Returns params if valid, null if invalid/expired.
 */
export function verifyActionUrl(searchParams) {
  const sig = searchParams.get("sig");
  const exp = parseInt(searchParams.get("exp") || "0", 10);

  if (!sig || !exp) return null;
  if (Date.now() / 1000 > exp) return null; // expired

  // Rebuild the payload without sig to verify
  const qs = new URLSearchParams();
  for (const [k, v] of searchParams.entries()) {
    if (k !== "sig") qs.set(k, v);
  }
  const payload = qs.toString();
  const expected = crypto.createHmac("sha256", SECRET()).update(payload).digest("hex");

  if (sig !== expected) return null; // tampered

  // Return all params
  const result = {};
  for (const [k, v] of searchParams.entries()) {
    if (k !== "sig") result[k] = v;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Rich Slack Message Builders
// ---------------------------------------------------------------------------

/**
 * Get a volunteer's legacy DM webhook URL by email (fallback).
 */
export function getVolunteerDm(email) {
  return LEGACY_WEBHOOK_DMS[email]?.() || null;
}

/**
 * Find the manager email for a given domain (e.g. "Anniversary Emails").
 * Returns the volunteer email of the first volunteer with appRole=manager whose
 * managerOf list includes the domain. Falls back to the founder if none found.
 */
export async function findDomainManagerEmail(domain) {
  try {
    const { default: vols } = await import("@/data/volunteers.json");
    const mgr = vols.find(
      (v) => v.appRole === "manager" && (v.managerOf || []).includes(domain)
    );
    if (mgr) return mgr.email;
    const founder = vols.find((v) => v.isFounder);
    return founder?.email || null;
  } catch {
    return null;
  }
}

/**
 * Post to a webhook URL.
 */
export async function postWebhook(webhookUrl, text) {
  if (!webhookUrl) return false;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send a DM to a user via Slack API (preferred) or legacy webhook (fallback).
 * Looks up slack_user_id from Supabase users table.
 *
 * @param {string} email — volunteer's email address
 * @param {string} text — message text (Slack mrkdwn)
 * @returns {boolean} — true if sent
 */
export async function sendSlackDm(email, text) {
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (botToken) {
    // Preferred: use Slack API with user's slack_user_id from DB
    try {
      const sb = getServerClient();
      // Try exact match first, then try matching by local part before @
      // (handles chris.marti@steel-hearts.org vs chris@steel-hearts.org)
      let { data: user } = await sb
        .from("users")
        .select("slack_user_id")
        .ilike("email", email)
        .limit(1)
        .single();

      if (!user?.slack_user_id) {
        // Try partial match: look for users whose email starts with the first name
        const localPart = email.split("@")[0]; // e.g. "chris.marti"
        const domain = email.split("@")[1];    // e.g. "steel-hearts.org"
        const firstName = localPart.split(".")[0]; // e.g. "chris"
        const { data: altUser } = await sb
          .from("users")
          .select("slack_user_id")
          .ilike("email", `${firstName}%@${domain}`)
          .not("slack_user_id", "is", null)
          .limit(1)
          .single();
        if (altUser?.slack_user_id) user = altUser;
      }

      if (user?.slack_user_id) {
        const res = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: user.slack_user_id, // DM by user ID
            text,
            mrkdwn: true,
          }),
        });
        const data = await res.json();
        if (data.ok) return true;
        console.warn("[slack] chat.postMessage failed:", data.error);
      }
    } catch (err) {
      console.warn("[slack] Bot DM failed:", err.message);
    }
  }

  // Fallback: legacy webhook
  const webhook = LEGACY_WEBHOOK_DMS[email]?.();
  if (webhook) {
    return postWebhook(webhook, text);
  }

  console.warn(`[slack] No DM method for ${email} — no bot token and no webhook`);
  return false;
}

/**
 * Dual-notify: post to ops hub + a person's DM.
 */
export async function notifyWithDm(text, dmWebhookUrl) {
  const opsUrl = process.env.SLACK_SOP_WEBHOOK;
  await Promise.all([
    postWebhook(opsUrl, text),
    dmWebhookUrl ? postWebhook(dmWebhookUrl, text) : Promise.resolve(),
  ]);
}

/**
 * Triple-notify: post to a channel + ops hub + a person's DM.
 */
export async function notifyWithChannelAndDm(text, channelWebhookUrl, dmWebhookUrl) {
  const opsUrl = process.env.SLACK_SOP_WEBHOOK;
  await Promise.all([
    postWebhook(opsUrl, text),
    channelWebhookUrl ? postWebhook(channelWebhookUrl, text) : Promise.resolve(),
    dmWebhookUrl ? postWebhook(dmWebhookUrl, text) : Promise.resolve(),
  ]);
}

// ---------------------------------------------------------------------------
// Production Messages
// ---------------------------------------------------------------------------

export function buildDesignNeededMessage(heroName, sku, size, orderCount, heroId) {
  const sizeStr = size ? ` ${size}"` : "";
  const orderNote = orderCount > 1 ? ` · ${orderCount} orders waiting` : "";
  const uploadUrl = createActionUrl("upload_design_page", { sku, hero: heroId || "", name: heroName });
  const queueUrl = createActionUrl("view_design_queue", {});
  const downloadUrl = `${APP_URL}/api/designs/download?sku=${encodeURIComponent(sku)}`;
  return [
    `🎨 *${heroName}* needs a${sizeStr} design`,
    `SKU: \`${sku}\`${orderNote}`,
    ``,
    `*Steps:*`,
    `1️⃣ Create the design in Illustrator (${sizeStr || "standard"} template)`,
    `2️⃣ Save as SVG named \`${sku}.svg\``,
    `3️⃣ Upload via the link below`,
    ``,
    `<${uploadUrl}|📤 Upload Design> · <${queueUrl}|📋 View Full Queue>`,
    size ? "" : `<${downloadUrl}|⬇️ Download Base Design (if exists)>`,
  ].filter(Boolean).join("\n");
}

export function buildReadyToLaserMessage(heroName, sku, size, itemIds) {
  const sizeStr = size ? ` ${size}"` : "";
  const downloadUrl = `${APP_URL}/api/designs/download?sku=${encodeURIComponent(sku)}`;
  const doneUrl = createActionUrl("advance_order", {
    items: itemIds.join(","),
    to: "ready_to_ship",
    name: heroName,
  });
  return [
    `🔥 *${heroName}*${sizeStr} ready to laser`,
    `<${downloadUrl}|Download SVG> · <${doneUrl}|Mark Done>`,
  ].join("\n");
}

export function buildReadyToShipMessage(orderNumber, customerName, itemIds) {
  const shippedUrl = createActionUrl("advance_order", {
    items: itemIds.join(","),
    to: "shipped",
    name: `Order #${orderNumber}`,
  });
  return [
    `📦 *Order #${orderNumber}* ready to ship — ${customerName}`,
    `<${shippedUrl}|Mark Shipped>`,
  ].join("\n");
}

export function buildShippedMessage(heroName) {
  return `✅ *${heroName}* bracelet shipped`;
}

/**
 * Build a design queue summary for Ryan (Slack DM).
 */
export function buildDesignQueueMessage(items) {
  if (!items || items.length === 0) {
    return `📋 *Design Queue* — All clear! No pending designs right now.`;
  }
  const lines = [
    `📋 *Design Queue* — ${items.length} item${items.length !== 1 ? "s" : ""} pending`,
    ``,
  ];
  for (const item of items.slice(0, 10)) {
    const sizeStr = item.size ? ` ${item.size}"` : "";
    const orderNote = item.orderCount > 1 ? ` (${item.orderCount} orders)` : "";
    const uploadUrl = createActionUrl("upload_design_page", {
      sku: item.sku,
      hero: item.heroId || "",
      name: item.heroName,
    });
    lines.push(`• \`${item.sku}\` *${item.heroName}*${sizeStr}${orderNote} — <${uploadUrl}|Upload>`);
  }
  if (items.length > 10) {
    lines.push(``, `_+ ${items.length - 10} more — <${APP_URL}/designs|View All in App>_`);
  }
  return lines.join("\n");
}

/**
 * Build a design upload confirmation for Ryan.
 */
export function buildDesignUploadedMessage(heroName, sku, advancedCount) {
  const laserNote = advancedCount > 0
    ? `\n🔥 ${advancedCount} order${advancedCount !== 1 ? "s" : ""} advanced to laser queue — Joseph notified.`
    : "";
  return `✅ Design uploaded for *${heroName}* (\`${sku}\`)${laserNote}`;
}

// ---------------------------------------------------------------------------
// Anniversary Messages
// ---------------------------------------------------------------------------

export function buildAnniversaryAssignedMessage(heroName, anniversaryDate, familyContact, heroId, volunteerName) {
  const draftUrl = createActionUrl("create_draft", { hero: heroId, name: heroName, volunteer: volunteerName || "" });
  const sentUrl = createActionUrl("mark_sent", { hero: heroId, name: heroName, volunteer: volunteerName || "" });
  const scheduledUrl = createActionUrl("mark_scheduled", { hero: heroId, name: heroName, volunteer: volunteerName || "" });
  const dateStr = anniversaryDate
    ? new Date(anniversaryDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "Unknown date";
  const familyStr = familyContact ? `Family contact: ${familyContact}` : "⚠️ No family contact on file — research needed first";
  return [
    `🎖️ *${heroName}* — Anniversary: ${dateStr}`,
    `You've been assigned this remembrance email.`,
    familyStr,
    ``,
    `*Steps:*`,
    `1️⃣ Click *Create Draft* below — a Gmail draft will be created for you`,
    `2️⃣ Open Gmail, review the email carefully (these go to Gold Star families)`,
    `3️⃣ Send it now OR schedule it for the anniversary date`,
    `4️⃣ Come back here and click *Sent* or *Scheduled*`,
    ``,
    `<${draftUrl}|📝 Create Draft>`,
    `<${sentUrl}|✅ Mark as Sent> · <${scheduledUrl}|📅 Mark as Scheduled>`,
    ``,
    `💡 *Tip:* In Gmail, click the arrow next to Send → "Schedule send" to deliver it on the exact anniversary date. This way you can draft and schedule all your assignments in one sitting.`,
  ].join("\n");
}

export function buildAnniversaryReminderMessage(heroName, daysUntil, status, heroId, volunteerName) {
  const draftUrl = createActionUrl("create_draft", { hero: heroId, name: heroName, volunteer: volunteerName || "" });
  const sentUrl = createActionUrl("mark_sent", { hero: heroId, name: heroName, volunteer: volunteerName || "" });
  const scheduledUrl = createActionUrl("mark_scheduled", { hero: heroId, name: heroName, volunteer: volunteerName || "" });
  const urgency = daysUntil <= 1 ? "🚨" : daysUntil <= 3 ? "⏰" : "📋";
  const dayWord = daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
  return [
    `${urgency} *Reminder:* ${heroName}'s anniversary is ${dayWord}`,
    `Status: ${status}`,
    `<${draftUrl}|📝 Create Draft> · <${sentUrl}|✅ Sent> · <${scheduledUrl}|📅 Scheduled>`,
  ].join("\n");
}

export function buildAnniversaryCompletedMessage(volunteerName, heroName, anniversaryDate) {
  const dateStr = new Date(anniversaryDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `✅ *${volunteerName}* sent the remembrance email for *${heroName}*\nAnniversary: ${dateStr} · Status: Complete`;
}

// ---------------------------------------------------------------------------
// Generic Task Assignment Messages
// ---------------------------------------------------------------------------

/**
 * Build a Slack DM for any task assignment (non-anniversary).
 */
export function buildTaskAssignedMessage({ taskId, title, description, priority, dueDate, role, assignerName }) {
  const doneUrl = createActionUrl("complete_task", { task: taskId, name: title });
  const openUrl = `${APP_URL}/me`;
  const priorityEmoji =
    priority === "critical" ? "🚨" :
    priority === "high"     ? "⏰" :
    priority === "medium"   ? "📋" : "📝";
  const lines = [
    `${priorityEmoji} *New assignment:* ${title}`,
  ];
  if (description) lines.push(description.length > 200 ? description.slice(0, 200) + "…" : description);
  const meta = [];
  if (priority) meta.push(`Priority: *${priority}*`);
  if (dueDate)  meta.push(`Due: ${new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
  if (role)     meta.push(`Role: ${role}`);
  if (assignerName) meta.push(`Assigned by: ${assignerName}`);
  if (meta.length) lines.push(meta.join(" · "));
  lines.push("");
  lines.push(`<${doneUrl}|✅ Mark Done> · <${openUrl}|📋 View My Assignments>`);
  return lines.join("\n");
}

export function buildAnniversaryEscalatedMessage(heroName, anniversaryDate, reason) {
  const dateStr = new Date(anniversaryDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `🔴 *${heroName}* anniversary escalated — ${dateStr}\nReason: ${reason || "Deadline approaching, not yet sent"}`;
}

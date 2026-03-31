import crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://shos-app.vercel.app";
const SECRET = () => process.env.SESSION_SECRET || "fallback-dev-secret";

// Volunteer DM webhook lookup — keyed by email
const VOLUNTEER_DMS = {
  "joseph.wiseman@steel-hearts.org": () => process.env.SLACK_DM_JOSEPH,
  "ryan.santana@steel-hearts.org": () => process.env.SLACK_DM_RYAN,
  "kristin.hughes@steel-hearts.org": () => process.env.SLACK_DM_KRISTIN,
  "chris.marti@steel-hearts.org": () => process.env.SLACK_DM_CHRIS,
};

// ---------------------------------------------------------------------------
// Signed Action URLs
// ---------------------------------------------------------------------------

/**
 * Create a signed action URL that can be clicked from Slack.
 * Expires after `ttlHours` (default 24h).
 */
export function createActionUrl(action, params = {}, ttlHours = 24) {
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
 * Get a volunteer's DM webhook URL by email.
 */
export function getVolunteerDm(email) {
  return VOLUNTEER_DMS[email]?.() || null;
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

export function buildDesignNeededMessage(heroName, sku, size, orderCount) {
  const sizeStr = size ? ` ${size}"` : "";
  const orderNote = orderCount > 1 ? ` · ${orderCount} orders waiting` : "";
  return [
    `🎨 *${heroName}* needs a${sizeStr} design`,
    `SKU: \`${sku}\`${orderNote}`,
    `<${APP_URL}/production|Upload Design in SHOS App>`,
  ].join("\n");
}

export function buildReadyToLaserMessage(heroName, sku, size, itemIds) {
  const sizeStr = size ? ` ${size}"` : "";
  const downloadUrl = `${APP_URL}/api/designs/download?sku=${encodeURIComponent(sku)}`;
  const doneUrl = createActionUrl("advance_order", {
    items: itemIds.join(","),
    to: "in_production",
    name: heroName,
  });
  return [
    `🔥 *${heroName}*${sizeStr} ready to laser`,
    `<${downloadUrl}|Download SVG> · <${doneUrl}|Mark Laser Started>`,
  ].join("\n");
}

export function buildInProductionDoneMessage(heroName, itemIds) {
  const doneUrl = createActionUrl("advance_order", {
    items: itemIds.join(","),
    to: "ready_to_ship",
    name: heroName,
  });
  return [
    `✅ *${heroName}* laser complete`,
    `<${doneUrl}|Mark Ready to Ship>`,
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

// ---------------------------------------------------------------------------
// Anniversary Messages
// ---------------------------------------------------------------------------

export function buildAnniversaryAssignedMessage(heroName, anniversaryDate, familyContact, heroId) {
  const draftUrl = createActionUrl("create_draft", { hero: heroId, name: heroName });
  const appUrl = `${APP_URL}/anniversaries`;
  const dateStr = new Date(anniversaryDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const familyStr = familyContact ? `\nFamily contact: ${familyContact}` : "\n⚠️ No family contact on file";
  return [
    `📅 *${heroName}* — Anniversary: ${dateStr}`,
    `You've been assigned this remembrance email.${familyStr}`,
    `<${draftUrl}|Create Draft> · <${appUrl}|View in App>`,
  ].join("\n");
}

export function buildAnniversaryReminderMessage(heroName, daysUntil, status, heroId) {
  const draftUrl = createActionUrl("create_draft", { hero: heroId, name: heroName });
  const urgency = daysUntil <= 1 ? "🚨" : daysUntil <= 3 ? "⏰" : "📋";
  const dayWord = daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
  return [
    `${urgency} *Reminder:* ${heroName}'s anniversary is ${dayWord}`,
    `Status: ${status}`,
    `<${draftUrl}|Create Draft>`,
  ].join("\n");
}

export function buildAnniversaryCompletedMessage(volunteerName, heroName, anniversaryDate) {
  const dateStr = new Date(anniversaryDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `✅ *${volunteerName}* sent the remembrance email for *${heroName}*\nAnniversary: ${dateStr} · Status: Complete`;
}

export function buildAnniversaryEscalatedMessage(heroName, anniversaryDate, reason) {
  const dateStr = new Date(anniversaryDate).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `🔴 *${heroName}* anniversary escalated — ${dateStr}\nReason: ${reason || "Deadline approaching, not yet sent"}`;
}

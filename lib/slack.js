/**
 * Slack Integration Module
 *
 * Centralizes all Slack posting. Replaces inline fetch() calls
 * scattered across routes.
 *
 * Channels:
 * - ops-hub: General operations notifications
 * - joseph-dm: Direct messages to Joseph
 */

const WEBHOOKS = {
  ops: () => process.env.SLACK_SOP_WEBHOOK,
  joseph: () => process.env.SLACK_DM_JOSEPH,
  ryan: () => process.env.SLACK_DM_RYAN,
};

/**
 * Post a message to a Slack channel/DM via webhook.
 * @param {string} channel — "ops", "joseph", or "ryan"
 * @param {string} text — Message text (supports Slack mrkdwn)
 * @returns {boolean} — true if sent successfully
 */
export async function postToSlack(channel, text) {
  const webhook = WEBHOOKS[channel]?.();
  if (!webhook) return false;

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Post to multiple channels at once.
 * @param {string[]} channels — Array of channel keys
 * @param {string} text — Message text
 */
export async function broadcastToSlack(channels, text) {
  await Promise.all(channels.map((ch) => postToSlack(ch, text)));
}

/**
 * Format a daily briefing for Slack.
 */
export function formatDailyBriefing({
  date,
  calendarEvents,
  queueTop,
  anniversaries,
  stats,
  learning,
}) {
  const lines = [];

  lines.push(`*Daily Briefing — ${date}*`);
  lines.push("");

  // Calendar
  if (calendarEvents?.length > 0) {
    lines.push(`*📅 Today's Calendar* (${calendarEvents.length} events)`);
    for (const e of calendarEvents.slice(0, 8)) {
      const time = e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
      });
      lines.push(`  ${time} — ${e.summary} [${e.role}]`);
    }
    lines.push("");
  }

  // Top queue items
  if (queueTop?.length > 0) {
    lines.push(`*🎯 Top Priorities* (${queueTop.length} shown)`);
    for (const item of queueTop.slice(0, 5)) {
      lines.push(`  ${item.icon} ${item.title} — ${item.rankReason} (~${item.estimatedMinutes}m)`);
    }
    lines.push("");
  }

  // Anniversaries
  if (anniversaries) {
    const { pending, total } = anniversaries;
    if (pending > 0) {
      lines.push(`*❤️ Anniversaries* — ${pending} pending of ${total} this month`);
      lines.push("");
    }
  }

  // Stats
  if (stats) {
    const parts = [];
    if (stats.completedThisMonth > 0) parts.push(`${stats.completedThisMonth} completed`);
    if (stats.hoursThisMonth > 0) parts.push(`${stats.hoursThisMonth}h invested`);
    if (stats.streak > 0) parts.push(`${stats.streak}d streak`);
    if (parts.length > 0) {
      lines.push(`*📊 This Month* — ${parts.join(" · ")}`);
    }
  }

  // Learning
  if (learning?.estimationAccuracy != null) {
    lines.push(`*🧠 Learning* — Estimation accuracy: ${learning.estimationAccuracy}% · Velocity: ${learning.velocityTrend}`);
    if (learning.neglectedDomains?.length > 0) {
      lines.push(`  ⚠️ Neglected: ${learning.neglectedDomains.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("_<https://shos.vercel.app|Open SHOS Dashboard>_");

  return lines.join("\n");
}

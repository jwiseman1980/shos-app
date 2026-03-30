/**
 * Daily Briefing Cron
 *
 * Runs at 7 AM ET (via Vercel cron or manual trigger).
 * Pulls today's calendar, top queue items, anniversary status,
 * stats, and learning metrics. Posts a formatted briefing to Slack.
 */

import { getServerClient } from "@/lib/supabase";
import { getTodayEvents } from "@/lib/calendar";
import { loadQueueItems, loadRecentDomains, loadScoreboardStats } from "@/lib/data/dashboard";
import { buildQueue } from "@/lib/priority-engine";
import { getLearningMetrics } from "@/lib/data/learning";
import { getAnniversariesThisMonth } from "@/lib/data/heroes";
import { postToSlack, broadcastToSlack, formatDailyBriefing } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request) {
  // Auth: Vercel CRON_SECRET or SHOS_API_KEY
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = new URL(request.url).searchParams.get("key") || request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;

  if (!isVercelCron && !isApiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Build a "system user" for data loading (founder-level access)
  const systemUser = { name: "System", domains: ["All"], isFounder: true };

  const [
    calendarEvents,
    { items, historicalAverages },
    recentDomains,
    stats,
    learning,
    anniversaries,
  ] = await Promise.all([
    getTodayEvents().catch(() => []),
    loadQueueItems(systemUser).catch(() => ({ items: [], historicalAverages: {} })),
    loadRecentDomains().catch(() => ({})),
    loadScoreboardStats(systemUser).catch(() => ({})),
    getLearningMetrics().catch(() => null),
    getAnniversariesThisMonth().catch(() => []),
  ]);

  const queue = buildQueue(items, recentDomains, historicalAverages);

  // Anniversary summary
  const annPending = anniversaries.filter((h) => {
    const s = (h.anniversaryStatus || "").toLowerCase().replace(/\s+/g, "_");
    return !["email_sent", "sent", "complete", "skipped"].includes(s);
  }).length;

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });

  const briefingText = formatDailyBriefing({
    date,
    calendarEvents,
    queueTop: queue.slice(0, 5),
    anniversaries: { pending: annPending, total: anniversaries.length },
    stats,
    learning,
  });

  // Post to ops channel and Joseph's DM
  await broadcastToSlack(["ops", "joseph"], briefingText);

  return Response.json({
    ok: true,
    date,
    eventsCount: calendarEvents.length,
    queueSize: queue.length,
    anniversariesPending: annPending,
    briefingLength: briefingText.length,
  });
}

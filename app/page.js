export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/auth";
import { loadQueueItems, loadRecentDomains, mergeCalendarAndQueue } from "@/lib/data/dashboard";
import { buildQueue } from "@/lib/priority-engine";
import { getTodayEvents } from "@/lib/calendar";
import { listInbox } from "@/lib/gmail";
import ConsoleLayout from "@/components/ConsoleLayout";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Get today's date range in ET for calendar */
function getTodayRange() {
  const tz = "America/New_York";
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });

  const etOffset = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(now).find(p => p.type === "timeZoneName")?.value || "GMT-5";
  const m = etOffset.match(/GMT([+-])(\d+)/);
  const tzSuffix = m ? `${m[1]}${m[2].padStart(2, "0")}:00` : "-05:00";

  return {
    timeMin: `${todayStr}T00:00:00${tzSuffix}`,
    timeMax: `${todayStr}T23:59:59${tzSuffix}`,
  };
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const firstName = user?.name?.split(" ")[0] || "Operator";
  const greeting = `${getGreeting()}, ${firstName}`;
  const { timeMin, timeMax } = getTodayRange();

  // Load all data in parallel
  const [
    { items, historicalAverages },
    recentDomains,
    calendarEvents,
    emailResult,
  ] = await Promise.all([
    loadQueueItems(user),
    loadRecentDomains(),
    getTodayEvents({ timeMin, timeMax }).catch((err) => {
      if (!err.message?.includes("not configured")) {
        console.error("[console] Calendar fetch failed:", err.message);
      }
      return [];
    }),
    listInbox({ maxResults: 30, query: "is:unread" }).catch((err) => {
      console.error("[console] Email fetch failed:", err.message);
      return { messages: [] };
    }),
  ]);

  // Build prioritized queue
  const queue = buildQueue(items, recentDomains, historicalAverages);

  // Merge calendar + queue into unified task list
  const tasks = mergeCalendarAndQueue(calendarEvents, queue);

  // Format emails for the triage panel
  const emails = (emailResult.messages || []).map((msg) => ({
    id: msg.id,
    subject: msg.subject || "(no subject)",
    from: msg.from || "",
    fromName: msg.from?.match(/^"?([^"<]*)"?\s*</)?.[ 1]?.trim() || msg.from,
    snippet: msg.snippet || "",
    date: msg.date,
    isUnread: msg.labelIds?.includes("UNREAD"),
    category: msg.category,
  }));

  return (
    <main className="dashboard-cockpit">
      <ConsoleLayout
        tasks={tasks}
        emails={emails}
        currentUser={user ? { name: user.name, email: user.email } : null}
        greeting={greeting}
      />
    </main>
  );
}

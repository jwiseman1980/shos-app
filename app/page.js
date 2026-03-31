export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/auth";
import { loadQueueItems, loadRecentDomains } from "@/lib/data/dashboard";
import { buildQueue } from "@/lib/priority-engine";
import { getTodayEvents } from "@/lib/calendar";
import { listInbox } from "@/lib/gmail";
import { classifyEmail } from "@/lib/email-classifier";
import CommandCenter from "@/components/CommandCenter";
import DashboardChat from "@/components/DashboardChat";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getDateString() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Compute 3-day date range in ET */
function get3DayRange() {
  const now = new Date();
  const tz = "America/New_York";
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz });

  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 2);
  const endStr = endDate.toLocaleDateString("en-CA", { timeZone: tz });

  // Get current ET offset
  const etOffset = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(now).find(p => p.type === "timeZoneName")?.value || "GMT-5";
  const m = etOffset.match(/GMT([+-])(\d+)/);
  const tzSuffix = m ? `${m[1]}${m[2].padStart(2, "0")}:00` : "-05:00";

  return {
    timeMin: `${todayStr}T00:00:00${tzSuffix}`,
    timeMax: `${endStr}T23:59:59${tzSuffix}`,
  };
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const firstName = user?.name?.split(" ")[0] || "Operator";
  const { timeMin, timeMax } = get3DayRange();

  // Load all data in parallel
  const [
    { items, historicalAverages },
    recentDomains,
    calendarEvents,
    inboxResult,
  ] = await Promise.all([
    loadQueueItems(user),
    loadRecentDomains(),
    getTodayEvents({ timeMin, timeMax }).catch((err) => {
      if (!err.message?.includes("not configured")) {
        console.error("[dashboard] Calendar fetch failed:", err.message);
      }
      return [];
    }),
    listInbox({ maxResults: 15 }).catch((err) => {
      console.error("[dashboard] Inbox fetch failed:", err.message);
      return { messages: [] };
    }),
  ]);

  // Build the priority queue
  const queue = buildQueue(items, recentDomains, historicalAverages);

  // Classify inbox emails
  const inboxEmails = (inboxResult.messages || []).map((m) => ({
    id: m.id,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet,
    date: m.date,
    isUnread: m.isUnread,
    category: classifyEmail(m.from, m.subject),
  }));

  return (
    <main className="dashboard-cockpit">
      {/* Header */}
      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>
          {getDateString()}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-bright)", margin: "0 0 16px" }}>
          {getGreeting()}, {firstName}
        </h1>
      </div>

      {/* Command Center fills available space */}
      <div style={{ flex: 1, padding: "0 24px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <CommandCenter
          events={calendarEvents}
          queue={queue}
          emails={inboxEmails}
        />
      </div>

      {/* Operator chat docked to bottom */}
      <DashboardChat currentUser={user} />
    </main>
  );
}

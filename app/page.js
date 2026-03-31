export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/auth";
import { loadQueueItems, loadRecentDomains } from "@/lib/data/dashboard";
import { buildQueue } from "@/lib/priority-engine";
import { getTodayEvents } from "@/lib/calendar";
import WeekCalendar from "@/components/WeekCalendar";
import TaskQueue from "@/components/TaskQueue";
import DashboardChat from "@/components/DashboardChat";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Get Monday-Sunday range for current week in ET */
function getWeekRange() {
  const tz = "America/New_York";
  const now = new Date();
  const todayET = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const dow = todayET.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;

  const monday = new Date(todayET);
  monday.setDate(todayET.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Get ET offset for RFC3339
  const etOffset = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(now).find(p => p.type === "timeZoneName")?.value || "GMT-5";
  const m = etOffset.match(/GMT([+-])(\d+)/);
  const tzSuffix = m ? `${m[1]}${m[2].padStart(2, "0")}:00` : "-05:00";

  const monStr = monday.toLocaleDateString("en-CA");
  const sunStr = sunday.toLocaleDateString("en-CA");

  return {
    timeMin: `${monStr}T00:00:00${tzSuffix}`,
    timeMax: `${sunStr}T23:59:59${tzSuffix}`,
    weekStart: monStr,
    weekLabel: `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2013 ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  };
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const firstName = user?.name?.split(" ")[0] || "Operator";
  const { timeMin, timeMax, weekStart, weekLabel } = getWeekRange();

  // Load all data in parallel
  const [
    { items, historicalAverages },
    recentDomains,
    calendarEvents,
  ] = await Promise.all([
    loadQueueItems(user),
    loadRecentDomains(),
    getTodayEvents({ timeMin, timeMax }).catch((err) => {
      if (!err.message?.includes("not configured")) {
        console.error("[dashboard] Calendar fetch failed:", err.message);
      }
      return [];
    }),
  ]);

  const queue = buildQueue(items, recentDomains, historicalAverages);

  return (
    <main className="dashboard-cockpit">
      {/* Header */}
      <div style={{ padding: "12px 24px 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-bright)", margin: 0 }}>
          {getGreeting()}, {firstName}
        </h1>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{weekLabel}</span>
      </div>

      {/* Week Calendar */}
      <div style={{ flex: 1, padding: "12px 24px 0", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <WeekCalendar events={calendarEvents} weekStart={weekStart} />
      </div>

      {/* Task Queue */}
      <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
        <TaskQueue items={queue} />
      </div>

      {/* Operator */}
      <DashboardChat currentUser={user} />
    </main>
  );
}

export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/auth";
import { loadQueueItems, loadRecentDomains, loadScoreboardStats, loadAccomplishments } from "@/lib/data/dashboard";
import { getLearningMetrics } from "@/lib/data/learning";
import { buildQueue } from "@/lib/priority-engine";
import { getTodayEvents } from "@/lib/calendar";
import PriorityQueue from "@/components/PriorityQueue";
import Scoreboard from "@/components/Scoreboard";
import Accomplishments from "@/components/Accomplishments";
import CalendarWidget from "@/components/CalendarWidget";

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

export default async function DashboardPage() {
  const user = await getSessionUser();
  const isAdmin = user?.domains?.includes("All") || user?.isFounder;
  const firstName = user?.name?.split(" ")[0] || "Operator";

  // Load all data in parallel
  const [
    { items, historicalAverages },
    recentDomains,
    stats,
    accomplishments,
    calendarEvents,
    learning,
  ] = await Promise.all([
    loadQueueItems(user),
    loadRecentDomains(),
    loadScoreboardStats(user),
    loadAccomplishments(user),
    getTodayEvents().catch((err) => {
      console.error("[dashboard] Calendar fetch failed:", err.message);
      return [];
    }),
    getLearningMetrics().catch((err) => {
      console.error("[dashboard] Learning metrics failed:", err.message);
      return null;
    }),
  ]);

  // Build the priority queue
  const queue = buildQueue(items, recentDomains, historicalAverages);

  return (
    <main className="page-shell">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>
          {getDateString()}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-bright)", margin: 0 }}>
          {getGreeting()}, {firstName}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
          {queue.length} items in your queue
          {stats.streak > 0 && ` \u00b7 ${stats.streak} day streak`}
        </p>
      </div>

      {/* Today's Calendar */}
      {calendarEvents.length > 0 && (
        <div className="data-card" style={{ marginBottom: 24 }}>
          <div className="data-card-header">
            <h2 className="data-card-title">Today</h2>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {calendarEvents.filter((e) => !e.allDay).length} events
            </span>
          </div>
          <CalendarWidget initialEvents={calendarEvents} />
        </div>
      )}

      {/* Scoreboard */}
      <div style={{ marginBottom: 24 }}>
        <Scoreboard stats={stats} learning={learning} isAdmin={isAdmin} />
      </div>

      {/* The Queue */}
      <div className="data-card" style={{ marginBottom: 24 }}>
        <div className="data-card-header">
          <h2 className="data-card-title">Your Queue</h2>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Ranked by urgency, impact, and what needs attention
          </span>
        </div>
        <PriorityQueue items={queue} userName={user?.name} />
      </div>

      {/* Accomplishments */}
      <div className="data-card">
        <div className="data-card-header">
          <h2 className="data-card-title">Recent Accomplishments</h2>
        </div>
        <Accomplishments items={accomplishments} />
      </div>
    </main>
  );
}

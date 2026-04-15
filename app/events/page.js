import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import EventManager from "@/components/EventManager";
import { getEvents, getEventStats } from "@/lib/data/events";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  let events = [];
  let stats = { total: 0, active: 0, totalRevenue: 0, totalExpected: 0 };

  try {
    [events, stats] = await Promise.all([getEvents(), getEventStats()]);
  } catch (err) {
    console.error("Events page error:", err.message);
  }

  return (
    <PageShell
      title="Event Management"
      subtitle={`${stats.total} events · ${stats.active} active · $${Math.round(stats.totalRevenue).toLocaleString()} raised`}
    >
      <div className="stat-grid">
        <StatBlock
          label="Total Events"
          value={stats.total || "--"}
          note="All time"
          accent="var(--gold)"
        />
        <StatBlock
          label="Active / Planning"
          value={stats.active || "--"}
          note="Upcoming events"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Revenue Raised"
          value={stats.totalRevenue > 0 ? `$${Math.round(stats.totalRevenue).toLocaleString()}` : "--"}
          note="Actual across all events"
          accent="var(--status-green)"
        />
        <StatBlock
          label="Revenue Pipeline"
          value={stats.totalExpected > 0 ? `$${Math.round(stats.totalExpected).toLocaleString()}` : "--"}
          note="Expected across active events"
          accent="var(--status-purple)"
        />
      </div>
      <EventManager initialEvents={events} />
    </PageShell>
  );
}

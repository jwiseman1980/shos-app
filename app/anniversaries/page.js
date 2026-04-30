export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import AnniversaryTracker from "@/components/AnniversaryTracker";
import PushToSlackButton from "@/components/PushToSlackButton";
import { getAnniversariesByMonth } from "@/lib/data/heroes";
import { getVolunteers } from "@/lib/data/volunteers";
import { getMonthName, getCurrentMonth, getCurrentYear, getDayOfMonth, yearsSince } from "@/lib/dates";
import { getSessionUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";
import Link from "next/link";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function normalizeStatus(status) {
  if (!status) return "not_assigned";
  return status.toLowerCase().replace(/\s+/g, "_");
}

export default async function AnniversariesPage({ searchParams }) {
  const params = await searchParams;
  const currentMonth = getCurrentMonth();
  const selectedMonth = params?.month ? parseInt(params.month, 10) : currentMonth;
  const statusFilter = params?.status || null;
  const volunteerFilter = params?.volunteer || null;

  const monthName = getMonthName(selectedMonth);
  const year = getCurrentYear();
  const isCurrentMonth = selectedMonth === currentMonth;

  // Load data
  const allHeroes = await getAnniversariesByMonth(selectedMonth);
  const volunteers = await getVolunteers();
  const currentUser = await getSessionUser();

  // Email-team volunteers (those with Anniversary Emails domain)
  const emailVolunteers = volunteers.filter(
    (v) => v.domains.includes("Anniversary Emails") || v.domains.includes("All")
  );

  // Collect unique assigned volunteers from the data
  const assignedVolunteers = [
    ...new Set(allHeroes.map((h) => h.anniversaryAssignedTo).filter(Boolean)),
  ].sort();

  // Apply filters
  let heroes = allHeroes;
  if (statusFilter) {
    if (statusFilter === "unassigned") {
      heroes = heroes.filter((h) => !h.anniversaryAssignedTo);
    } else if (statusFilter === "no_contact") {
      heroes = heroes.filter((h) => !h.familyContactId);
    } else {
      heroes = heroes.filter((h) => normalizeStatus(h.anniversaryStatus) === statusFilter);
    }
  }
  if (volunteerFilter) {
    heroes = heroes.filter((h) => h.anniversaryAssignedTo === volunteerFilter);
  }

  // Sort by day of month and add computed fields for client
  const sorted = [...heroes]
    .sort((a, b) => {
      return (getDayOfMonth(a.memorialDate) || a.anniversaryDay || 0) -
        (getDayOfMonth(b.memorialDate) || b.anniversaryDay || 0);
    })
    .map((hero) => {
      return {
        ...hero,
        dayOfMonth: getDayOfMonth(hero.memorialDate) || hero.anniversaryDay || 0,
        years: yearsSince(hero.memorialDate),
        needsResearch: !hero.familyContactId,
      };
    });

  // Auto-create research tasks for heroes with no family contact
  // Only creates if no existing open task for this hero+month
  const researchHeroes = sorted.filter(
    (h) => normalizeStatus(h.anniversaryStatus) === "research"
  );
  if (researchHeroes.length > 0) {
    try {
      const sb = getServerClient();
      const heroIds = researchHeroes.map((h) => h.id).filter(Boolean);

      // Check which heroes already have open research tasks
      const { data: existingTasks } = await sb
        .from("tasks")
        .select("hero_id")
        .in("hero_id", heroIds)
        .in("status", ["backlog", "todo", "in_progress"])
        .eq("domain", "family");

      const existingHeroIds = new Set((existingTasks || []).map((t) => t.hero_id));

      // Create tasks for heroes that don't have one yet
      const newTasks = researchHeroes
        .filter((h) => h.id && !existingHeroIds.has(h.id))
        .map((h) => ({
          title: `Research family contact — ${h.name}`,
          description: `No family contact on file for ${h.name}. Find contact info so the anniversary email can be sent. Memorial date: ${getMonthName(selectedMonth)} ${h.dayOfMonth}.`,
          status: "todo",
          priority: "high",
          role: "ed",
          domain: "family",
          hero_id: h.id,
          tags: ["anniversary", "research"],
        }));

      if (newTasks.length > 0) {
        await sb.from("tasks").insert(newTasks);
      }
    } catch (taskErr) {
      console.warn("[anniversaries] Auto-task creation failed:", taskErr.message);
    }
  }

  // Simple stats: Sent / Scheduled / Not Sent
  const totalThisMonth = sorted.length;
  const sentCount = sorted.filter((h) => normalizeStatus(h.anniversaryStatus) === "sent").length;
  const scheduledCount = sorted.filter((h) => normalizeStatus(h.anniversaryStatus) === "scheduled").length;
  const notSentCount = totalThisMonth - sentCount - scheduledCount;
  const assignedCount = sorted.filter((h) => h.anniversaryAssignedTo).length;
  const researchCount = sorted.filter((h) => h.needsResearch && normalizeStatus(h.anniversaryStatus) === "not_sent").length;
  const completedCount = sentCount + scheduledCount;

  const today = new Date().getDate();

  // Build filter URL helper
  function filterUrl(overrides = {}) {
    const p = { month: selectedMonth };
    if (statusFilter) p.status = statusFilter;
    if (volunteerFilter) p.volunteer = volunteerFilter;
    Object.assign(p, overrides);
    Object.keys(p).forEach((k) => {
      if (p[k] === null || p[k] === undefined || p[k] === "") delete p[k];
    });
    const qs = new URLSearchParams(p).toString();
    return `/anniversaries${qs ? "?" + qs : ""}`;
  }

  return (
    <PageShell
      title="Anniversary Email Tracker"
      subtitle={`${monthName} ${year} — ${totalThisMonth} remembrances this month`}
      action={<PushToSlackButton />}
    >
      {/* Month Selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Month:
        </span>
        {MONTH_OPTIONS.map((m) => (
          <Link
            key={m.value}
            href={filterUrl({ month: m.value, status: statusFilter, volunteer: volunteerFilter })}
            className={m.value === selectedMonth ? "btn btn-primary" : "btn btn-ghost"}
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            {m.label.slice(0, 3)}
          </Link>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Total"
          value={totalThisMonth}
          note={isCurrentMonth ? "Current month" : monthName}
          accent="var(--gold)"
        />
        <StatBlock
          label="Sent"
          value={sentCount}
          note={totalThisMonth > 0 ? `${Math.round((completedCount / totalThisMonth) * 100)}% done` : "--"}
          accent="var(--status-green)"
        />
        {scheduledCount > 0 && (
          <StatBlock
            label="Scheduled"
            value={scheduledCount}
            note="In Gmail, awaiting send"
            accent="var(--status-blue)"
          />
        )}
        <StatBlock
          label="Not Sent"
          value={notSentCount}
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Assigned"
          value={assignedCount}
          note={`${totalThisMonth - assignedCount} unassigned`}
          accent="var(--status-purple)"
        />
        {researchCount > 0 && (
          <StatBlock
            label="No Contact"
            value={researchCount}
            note="Need family research"
            accent="var(--status-red)"
          />
        )}
      </div>

      {/* Progress Bar */}
      {totalThisMonth > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Completion Progress
            </span>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {completedCount}/{totalThisMonth}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.round((completedCount / totalThisMonth) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Status:
          </span>
          <Link
            href={filterUrl({ status: null })}
            className={!statusFilter ? "btn btn-primary" : "btn btn-ghost"}
            style={{ padding: "3px 8px", fontSize: 11 }}
          >
            All
          </Link>
          {[
            { key: "not_sent", label: "Not Sent" },
            { key: "scheduled", label: "Scheduled" },
            { key: "sent", label: "Sent" },
            { key: "unassigned", label: "Unassigned" },
            { key: "no_contact", label: "No Contact" },
          ].map((s) => (
            <Link
              key={s.key}
              href={filterUrl({ status: s.key })}
              className={statusFilter === s.key ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {assignedVolunteers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Volunteer:
            </span>
            <Link
              href={filterUrl({ volunteer: null })}
              className={!volunteerFilter ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              All
            </Link>
            {assignedVolunteers.map((v) => (
              <Link
                key={v}
                href={filterUrl({ volunteer: v })}
                className={volunteerFilter === v ? "btn btn-primary" : "btn btn-ghost"}
                style={{ padding: "3px 8px", fontSize: 11 }}
              >
                {v}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Active filter indicator */}
      {(statusFilter || volunteerFilter) && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Showing {sorted.length} of {totalThisMonth} heroes
          </span>
          <Link
            href={filterUrl({ status: null, volunteer: null })}
            style={{ fontSize: 12, color: "var(--gold)" }}
          >
            Clear filters
          </Link>
        </div>
      )}

      {/* Interactive Hero Table */}
      <DataCard title={`${monthName} Anniversary Calendar — ${sorted.length} ${sorted.length === 1 ? "hero" : "heroes"}`}>
        {totalThisMonth === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No heroes with anniversaries in {monthName}.
          </p>
        ) : (
          <AnniversaryTracker
            heroes={sorted}
            monthName={monthName}
            isCurrentMonth={isCurrentMonth}
            volunteers={emailVolunteers}
            today={today}
            currentUser={currentUser}
          />
        )}
      </DataCard>

      {/* Workflow Card */}
      <DataCard title="How It Works">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              flex: "1 1 200px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
              1. Assign (App)
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
              Use the dropdown to assign a volunteer. They get a Slack DM with instructions.
            </div>
          </div>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              flex: "1 1 200px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
              2. Draft & Send (Slack)
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
              Volunteers click "Create Draft" in their Slack DM, review in Gmail, then send or schedule.
            </div>
          </div>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-md)",
              flex: "1 1 200px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
              3. Mark Done (Slack)
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
              After sending, volunteers click "Sent" or "Scheduled" in Slack. Status updates here automatically.
            </div>
          </div>
        </div>
      </DataCard>
    </PageShell>
  );
}

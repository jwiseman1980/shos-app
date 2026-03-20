import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import StatusBadge from "@/components/StatusBadge";
import { getAnniversariesByMonth } from "@/lib/data/heroes";
import { getVolunteers } from "@/lib/data/volunteers";
import { getMonthName, getCurrentMonth, getCurrentYear, getDayOfMonth, yearsSince } from "@/lib/dates";
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

// Normalize status strings for comparison and StatusBadge mapping
function normalizeStatus(status) {
  if (!status) return "not_started";
  return status.toLowerCase().replace(/\s+/g, "_");
}

function statusLabel(status) {
  const key = normalizeStatus(status);
  const labels = {
    not_started: "Not Started",
    in_progress: "In Progress",
    email_sent: "Email Sent",
    complete: "Complete",
    completed: "Complete",
    blocked: "Blocked",
  };
  return labels[key] || status || "Not Started";
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

  // Collect unique assigned volunteers from the data
  const assignedVolunteers = [
    ...new Set(allHeroes.map((h) => h.anniversaryAssignedTo).filter(Boolean)),
  ].sort();

  // Apply filters
  let heroes = allHeroes;
  if (statusFilter) {
    heroes = heroes.filter((h) => normalizeStatus(h.anniversaryStatus) === statusFilter);
  }
  if (volunteerFilter) {
    heroes = heroes.filter((h) => h.anniversaryAssignedTo === volunteerFilter);
  }

  // Sort by day of month
  const sorted = [...heroes].sort((a, b) => {
    return (getDayOfMonth(a.memorialDate) || a.anniversaryDay || 0) - (getDayOfMonth(b.memorialDate) || b.anniversaryDay || 0);
  });

  // Compute stats from ALL heroes this month (before filtering)
  const totalThisMonth = allHeroes.length;
  const completedCount = allHeroes.filter((h) => {
    const s = normalizeStatus(h.anniversaryStatus);
    return s === "complete" || s === "completed" || s === "email_sent";
  }).length;
  const inProgressCount = allHeroes.filter(
    (h) => normalizeStatus(h.anniversaryStatus) === "in_progress"
  ).length;
  const blockedCount = allHeroes.filter(
    (h) => normalizeStatus(h.anniversaryStatus) === "blocked"
  ).length;
  const notStartedCount = totalThisMonth - completedCount - inProgressCount - blockedCount;

  const today = new Date().getDate();

  // Build filter URL helper
  function filterUrl(overrides = {}) {
    const p = { month: selectedMonth };
    if (statusFilter) p.status = statusFilter;
    if (volunteerFilter) p.volunteer = volunteerFilter;
    Object.assign(p, overrides);
    // Remove null/undefined values
    Object.keys(p).forEach((k) => {
      if (p[k] === null || p[k] === undefined || p[k] === "") delete p[k];
    });
    const qs = new URLSearchParams(p).toString();
    return `/anniversaries${qs ? "?" + qs : ""}`;
  }

  return (
    <PageShell
      title="Anniversary Tracker"
      subtitle={`${monthName} ${year} — ${totalThisMonth} remembrances this month`}
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
          label="Total This Month"
          value={totalThisMonth}
          note={isCurrentMonth ? "Current month" : monthName}
          accent="var(--gold)"
        />
        <StatBlock
          label="Completed"
          value={completedCount}
          note={totalThisMonth > 0 ? `${Math.round((completedCount / totalThisMonth) * 100)}% done` : "—"}
          accent="var(--status-green)"
        />
        <StatBlock
          label="In Progress"
          value={inProgressCount}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Not Started"
          value={notStartedCount}
          accent="var(--status-gray)"
        />
        {blockedCount > 0 && (
          <StatBlock
            label="Blocked"
            value={blockedCount}
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
            { key: "not_started", label: "Not Started" },
            { key: "in_progress", label: "In Progress" },
            { key: "email_sent", label: "Email Sent" },
            { key: "complete", label: "Complete" },
            { key: "blocked", label: "Blocked" },
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

      {/* Hero Table */}
      <DataCard title={`${monthName} Anniversary Calendar — ${sorted.length} ${sorted.length === 1 ? "hero" : "heroes"}`}>
        {sorted.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            {totalThisMonth === 0
              ? `No heroes with anniversaries in ${monthName}.`
              : "No heroes match the current filters."}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Hero</th>
                <th>Branch</th>
                <th>Years</th>
                <th>Assigned To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((hero) => {
                const day = hero.anniversaryDay || getDayOfMonth(hero.memorialDate);
                const years = yearsSince(hero.memorialDate);
                const isPast = isCurrentMonth && day < today;
                const isToday = isCurrentMonth && day === today;
                const status = normalizeStatus(hero.anniversaryStatus);

                return (
                  <tr key={hero.sfId}>
                    <td
                      style={{
                        fontWeight: isToday ? 700 : 400,
                        color: isToday
                          ? "var(--gold)"
                          : isPast
                          ? "var(--text-dim)"
                          : "var(--text)",
                      }}
                    >
                      {monthName.slice(0, 3)} {day}
                      {isToday && (
                        <span style={{ fontSize: 10, marginLeft: 6, color: "var(--gold)", fontWeight: 600 }}>
                          TODAY
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          color: isPast && status !== "not_started"
                            ? "var(--text-dim)"
                            : "var(--text-bright)",
                          fontWeight: 500,
                        }}
                      >
                        {hero.fullName.replace(/\s*\(.*?\)\s*/, "")}
                      </span>
                    </td>
                    <td>{hero.serviceCode}</td>
                    <td>{years}</td>
                    <td style={{ fontSize: 12 }}>
                      {hero.anniversaryAssignedTo || (
                        <span style={{ color: "var(--text-dim)" }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        status={status}
                        label={statusLabel(hero.anniversaryStatus)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DataCard>

      {/* Notes section — show heroes with notes */}
      {sorted.some((h) => h.anniversaryNotes) && (
        <div className="section" style={{ marginTop: 24 }}>
          <div className="section-title">Anniversary Notes</div>
          {sorted
            .filter((h) => h.anniversaryNotes)
            .map((hero) => (
              <DataCard key={hero.sfId + "-note"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
                      {hero.fullName.replace(/\s*\(.*?\)\s*/, "")}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text)" }}>
                      {hero.anniversaryNotes}
                    </div>
                  </div>
                  <StatusBadge
                    status={normalizeStatus(hero.anniversaryStatus)}
                    label={statusLabel(hero.anniversaryStatus)}
                  />
                </div>
              </DataCard>
            ))}
        </div>
      )}
    </PageShell>
  );
}

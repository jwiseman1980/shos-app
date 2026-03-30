import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import { getAnniversariesThisMonth } from "@/lib/data/heroes";
import { getVolunteers } from "@/lib/data/volunteers";
import { getMonthName, getCurrentMonth, getCurrentYear, getDayOfMonth, yearsSince } from "@/lib/dates";

export default async function EmailComposerPage() {
  const heroes = await getAnniversariesThisMonth();
  const volunteers = await getVolunteers();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const monthName = getMonthName(month);

  // Sort by day of month
  const sorted = [...heroes].sort((a, b) => {
    const dayA = getDayOfMonth(a.memorialDate) || 0;
    const dayB = getDayOfMonth(b.memorialDate) || 0;
    return dayA - dayB;
  });

  // Group by status
  const needsEmail = sorted.filter(
    (h) => !h.anniversaryStatus || h.anniversaryStatus === "Not Started"
  );
  const inProgress = sorted.filter(
    (h) => h.anniversaryStatus === "In Progress" || h.anniversaryStatus === "Assigned"
  );
  const completed = sorted.filter(
    (h) =>
      h.anniversaryStatus === "Complete" ||
      h.anniversaryStatus === "Completed" ||
      h.anniversaryStatus === "Email Sent"
  );

  // Eligible email volunteers (those with Anniversary Emails domain)
  const emailVolunteers = volunteers.filter(
    (v) => v.domains?.includes("Anniversary Emails") || v.domains?.includes("All")
  );

  return (
    <PageShell
      title="Email Composer"
      subtitle={`${monthName} ${year} — Anniversary Remembrance Emails`}
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Total This Month"
          value={sorted.length}
          note={`${monthName} anniversaries`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Needs Email"
          value={needsEmail.length}
          note="Not yet started"
          accent="var(--status-red)"
        />
        <StatBlock
          label="In Progress"
          value={inProgress.length}
          note="Assigned or drafting"
          accent="var(--status-orange)"
        />
        <StatBlock
          label="Completed"
          value={completed.length}
          note="Email sent"
          accent="var(--status-green)"
        />
      </div>

      {/* Progress Bar */}
      <div className="section">
        <DataCard title="Email Progress">
          <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--text-dim)" }}>
              {completed.length} of {sorted.length} complete
            </span>
            <span style={{ color: "var(--text-bright)", fontWeight: 600 }}>
              {sorted.length > 0 ? Math.round((completed.length / sorted.length) * 100) : 0}%
            </span>
          </div>
          <div
            style={{
              height: 12,
              background: "var(--card-border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              display: "flex",
            }}
          >
            {completed.length > 0 && (
              <div
                style={{
                  width: `${(completed.length / sorted.length) * 100}%`,
                  background: "var(--status-green)",
                  transition: "width 0.3s ease",
                }}
              />
            )}
            {inProgress.length > 0 && (
              <div
                style={{
                  width: `${(inProgress.length / sorted.length) * 100}%`,
                  background: "var(--status-orange)",
                  transition: "width 0.3s ease",
                }}
              />
            )}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-dim)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--status-green)" }} /> Sent
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-dim)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--status-orange)" }} /> In Progress
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-dim)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--card-border)" }} /> Not Started
            </div>
          </div>
        </DataCard>
      </div>

      <div className="grid-2">
        {/* Needs Email - Queue */}
        <DataCard title={`Needs Email (${needsEmail.length})`}>
          {needsEmail.length === 0 ? (
            <p style={{ color: "var(--status-green)", fontSize: 13 }}>
              All heroes have been assigned or completed!
            </p>
          ) : (
            <div style={{ maxHeight: 450, overflowY: "auto" }}>
              {needsEmail.map((hero) => {
                const day = getDayOfMonth(hero.memorialDate);
                const years = yearsSince(hero.memorialDate);
                return (
                  <div key={hero.sfId} className="list-item">
                    <div>
                      <div className="list-item-title">
                        {hero.fullName ? hero.fullName.replace(/\s*\(.*?\)\s*/, "") : hero.name}
                      </div>
                      <div className="list-item-sub">
                        {monthName} {day} &middot; {years} years &middot; {hero.serviceCode}
                      </div>
                      {hero.charityName && (
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                          Charity: {hero.charityName}
                        </div>
                      )}
                    </div>
                    <StatusBadge status="Not Started" />
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>

        {/* In Progress */}
        <DataCard title={`In Progress (${inProgress.length})`}>
          {inProgress.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              No emails currently in progress.
            </p>
          ) : (
            <div style={{ maxHeight: 450, overflowY: "auto" }}>
              {inProgress.map((hero) => {
                const day = getDayOfMonth(hero.memorialDate);
                const years = yearsSince(hero.memorialDate);
                return (
                  <div key={hero.sfId} className="list-item">
                    <div>
                      <div className="list-item-title">
                        {hero.fullName ? hero.fullName.replace(/\s*\(.*?\)\s*/, "") : hero.name}
                      </div>
                      <div className="list-item-sub">
                        {monthName} {day} &middot; {years} years &middot; {hero.serviceCode}
                      </div>
                      {hero.anniversaryAssignedTo && (
                        <div style={{ fontSize: 11, color: "var(--status-blue)", marginTop: 2 }}>
                          Assigned to: {hero.anniversaryAssignedTo}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={hero.anniversaryStatus || "In Progress"} />
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="section" style={{ marginTop: 24 }}>
          <DataCard title={`Completed (${completed.length})`}>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {completed.map((hero) => {
                const day = getDayOfMonth(hero.memorialDate);
                const years = yearsSince(hero.memorialDate);
                return (
                  <div key={hero.sfId} className="list-item">
                    <div>
                      <div className="list-item-title">
                        {hero.fullName ? hero.fullName.replace(/\s*\(.*?\)\s*/, "") : hero.name}
                      </div>
                      <div className="list-item-sub">
                        {monthName} {day} &middot; {years} years
                        {hero.anniversaryAssignedTo && ` \u00b7 ${hero.anniversaryAssignedTo}`}
                        {hero.anniversaryCompletedDate && ` \u00b7 Sent ${hero.anniversaryCompletedDate}`}
                      </div>
                    </div>
                    <StatusBadge status="Complete" />
                  </div>
                );
              })}
            </div>
          </DataCard>
        </div>
      )}

      {/* Email Team */}
      <div className="section">
        <DataCard title={`Email Team (${emailVolunteers.length} volunteers)`}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {emailVolunteers.map((v) => (
              <div
                key={v.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: v.color || "var(--text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {v.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>
                    {v.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{v.role}</div>
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Email Template Reference */}
      <div className="section">
        <DataCard title="Email Template Guide">
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: "var(--gold)" }}>Subject Line Format:</span>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-dim)", marginTop: 4, padding: "8px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
                Remembering [Rank] [First] [Last] — [Year Count] Year Anniversary
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: "var(--gold)" }}>Key Elements:</span>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: "var(--text-dim)" }}>
                <li>Personal greeting to the family</li>
                <li>Reference the hero by rank and name</li>
                <li>Mention the anniversary year count</li>
                <li>Note the charity receiving donations in their honor</li>
                <li>Include link to the bio page if available</li>
                <li>Sign off from Steel Hearts Foundation</li>
              </ul>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
              Use the Anniversary Tracker for full workflow management. This page shows the email queue at a glance.
            </div>
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}

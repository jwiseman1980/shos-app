"use client";

import { useState } from "react";
import Link from "next/link";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ActionRow({ icon, label, source, children, href }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "10px 0", borderBottom: "1px solid var(--card-border)",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-bright)", fontWeight: 500 }}>{label}</div>
        {children && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{children}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 10, padding: "2px 6px", borderRadius: 8,
          background: "var(--card-bg)", border: "1px solid var(--card-border)",
          color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase",
        }}>
          {source}
        </span>
        {href && (
          <Link href={href} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}>
            {"\u2192"}
          </Link>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ completed, total, color = "var(--status-green)" }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 6, borderRadius: 3,
        background: "var(--card-border)", overflow: "hidden",
      }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

export default function DailyBrief({
  user,
  heroStats,
  thisMonthHeroes = [],
  sopsDueToday = [],
  allSops = [],
  volunteers = [],
  donationStats,
  recentDonations = [],
  designStats,
  orderStats,
  monthName,
}) {
  const isAdmin = user?.isFounder || user?.domains?.includes("All");
  const userName = user?.name?.split(" ")[0] || "there";

  // Filter anniversary heroes assigned to this user
  const myAnniversaries = thisMonthHeroes.filter(
    (h) => h.anniversaryAssignedTo === user?.name
  );
  const myCompleted = myAnniversaries.filter(
    (h) => h.anniversaryStatus === "Sent" || h.anniversaryStatus === "Complete"
  );
  const myPending = myAnniversaries.filter(
    (h) => h.anniversaryStatus !== "Sent" && h.anniversaryStatus !== "Complete" && h.anniversaryStatus !== "Skipped"
  );

  // All anniversary stats for admin view
  const allCompleted = thisMonthHeroes.filter(
    (h) => h.anniversaryStatus === "Sent" || h.anniversaryStatus === "Complete"
  );

  // Unthank'd donations (last 7 days)
  const unthankedDonations = recentDonations.filter((d) => !d.thankYouSent);

  // Build action items
  const actionItems = [];

  // Anniversary emails for this user
  myPending.forEach((h) => {
    actionItems.push({
      icon: "\u2605",
      label: `Send anniversary email for ${h.name}`,
      detail: h.familyEmail ? `Family: ${h.familyEmail}` : "No family email — needs research",
      source: "Anniversary",
      href: "/anniversaries",
      priority: h.familyEmail ? 1 : 3,
    });
  });

  // SOPs due today
  sopsDueToday.forEach((s) => {
    actionItems.push({
      icon: "\u2611",
      label: `Run ${s.id}: ${s.title}`,
      detail: `${s.cadence} \u00b7 ${s.timeBox || "15-20 min"}`,
      source: "SOP",
      href: `/sops/${s.id}`,
      priority: 2,
    });
  });

  // Admin-only items
  if (isAdmin) {
    // Unthank'd donors
    unthankedDonations.forEach((d) => {
      actionItems.push({
        icon: "\u2665",
        label: `Thank ${d.donorName || d.donorEmail} for $${d.amount} donation`,
        detail: new Date(d.donationDate).toLocaleDateString(),
        source: "Donor",
        href: "/donors",
        priority: 2,
      });
    });

    // Design tasks
    if (designStats && (designStats.queued > 0 || designStats.inProgress > 0)) {
      actionItems.push({
        icon: "\u270E",
        label: `${designStats.queued + designStats.inProgress} design tasks need attention`,
        detail: `${designStats.queued} queued, ${designStats.inProgress} in progress`,
        source: "Design",
        href: "/designs",
        priority: 2,
      });
    }
  }

  // Sort by priority
  actionItems.sort((a, b) => a.priority - b.priority);

  // Team progress for admin
  const teamProgress = isAdmin
    ? volunteers
        .filter((v) => !v.isExternal)
        .map((v) => {
          const assigned = thisMonthHeroes.filter((h) => h.anniversaryAssignedTo === v.name);
          const done = assigned.filter(
            (h) => h.anniversaryStatus === "Sent" || h.anniversaryStatus === "Complete"
          );
          return { ...v, assigned: assigned.length, completed: done.length };
        })
        .filter((v) => v.assigned > 0)
        .sort((a, b) => b.assigned - a.assigned)
    : [];

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 300, color: "var(--text-bright)", margin: 0 }}>
          {getGreeting()}, {userName}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "4px 0 0" }}>
          {user?.role} {"\u00b7"} {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* My Stats */}
      <div className="stat-grid">
        <StatBlock
          label="My Anniversaries"
          value={`${myCompleted.length}/${myAnniversaries.length}`}
          note={myPending.length > 0 ? `${myPending.length} need action` : "All done"}
          accent={myPending.length > 0 ? "var(--status-orange)" : "var(--status-green)"}
        />
        <StatBlock
          label="SOPs Due Today"
          value={sopsDueToday.length}
          note={sopsDueToday.length > 0 ? sopsDueToday.map((s) => s.id).join(", ") : "None due"}
          accent={sopsDueToday.length > 0 ? "var(--status-blue)" : "var(--status-green)"}
        />
        {isAdmin && (
          <>
            <StatBlock
              label="Donors to Thank"
              value={unthankedDonations.length}
              note="Last 7 days"
              accent={unthankedDonations.length > 0 ? "var(--status-orange)" : "var(--status-green)"}
            />
            <StatBlock
              label="Heroes Honored"
              value={heroStats?.total || 0}
              note={`${heroStats?.active || 0} active listings`}
              accent="var(--gold)"
            />
          </>
        )}
        {!isAdmin && (
          <>
            <StatBlock
              label={`${monthName} Progress`}
              value={`${allCompleted.length}/${thisMonthHeroes.length}`}
              note="Team total this month"
              accent="var(--status-blue)"
            />
            <StatBlock
              label="Heroes Honored"
              value={heroStats?.total || 0}
              note={`${heroStats?.active || 0} active listings`}
              accent="var(--gold)"
            />
          </>
        )}
      </div>

      {/* Action Items */}
      <div className="section">
        <DataCard title={`Action Items (${actionItems.length})`}>
          {actionItems.length > 0 ? (
            <div>
              {actionItems.map((item, i) => (
                <ActionRow key={i} icon={item.icon} label={item.label} source={item.source} href={item.href}>
                  {item.detail}
                </ActionRow>
              ))}
            </div>
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--status-green)", fontSize: 14 }}>
              {"\u2713"} All caught up! No action items right now.
            </div>
          )}
        </DataCard>
      </div>

      {/* Anniversary Progress */}
      {thisMonthHeroes.length > 0 && (
        <div className="section">
          <DataCard title={`${monthName} Anniversary Progress`}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-bright)", marginBottom: 4 }}>
                {isAdmin ? "Team" : "My"} Progress: {isAdmin ? allCompleted.length : myCompleted.length} / {isAdmin ? thisMonthHeroes.length : myAnniversaries.length} complete
              </div>
              <ProgressBar
                completed={isAdmin ? allCompleted.length : myCompleted.length}
                total={isAdmin ? thisMonthHeroes.length : myAnniversaries.length}
              />
            </div>

            {/* My pending anniversaries — actionable */}
            {myPending.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  My Pending ({myPending.length})
                </div>
                {myPending.map((h) => (
                  <div key={h.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid var(--card-border)",
                  }}>
                    <div>
                      <span style={{ fontSize: 13, color: "var(--text-bright)", fontWeight: 500 }}>{h.name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>
                        {h.memorialDate ? new Date(h.memorialDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {h.familyEmail ? (
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{h.familyEmail}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--status-orange)" }}>No email</span>
                      )}
                      <Link href="/anniversaries" style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 6,
                        background: "var(--gold-22)", color: "var(--gold)",
                        textDecoration: "none", fontWeight: 600,
                      }}>
                        Send
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Team progress — admin only */}
            {isAdmin && teamProgress.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Team Progress
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 11, color: "var(--text-dim)" }}>Volunteer</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 11, color: "var(--text-dim)" }}>Assigned</th>
                        <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 11, color: "var(--text-dim)" }}>Done</th>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 11, color: "var(--text-dim)", width: "40%" }}>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamProgress.map((v) => (
                        <tr key={v.email} style={{ borderBottom: "1px solid var(--card-border)" }}>
                          <td style={{ padding: "6px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: "50%", background: v.color,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 9, fontWeight: 700, color: "#fff",
                              }}>
                                {v.initials}
                              </div>
                              <span style={{ color: "var(--text-bright)" }}>{v.name.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "var(--text-dim)" }}>{v.assigned}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", color: "var(--status-green)" }}>{v.completed}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <ProgressBar completed={v.completed} total={v.assigned} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, textAlign: "right" }}>
              <Link href="/anniversaries" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}>
                View Full Tracker {"\u2192"}
              </Link>
            </div>
          </DataCard>
        </div>
      )}

      {/* SOP Quick-Run */}
      {sopsDueToday.length > 0 && (
        <div className="section">
          <DataCard title={`SOPs Due Today (${sopsDueToday.length})`}>
            {sopsDueToday.map((s) => (
              <div key={s.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: "1px solid var(--card-border)",
              }}>
                <div>
                  <span style={{ fontSize: 13, color: "var(--text-bright)", fontWeight: 500 }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{s.cadence} {"\u00b7"} {s.timeBox || ""}</span>
                </div>
                <Link href={`/sops/${s.id}`} style={{
                  fontSize: 11, padding: "4px 12px", borderRadius: 6,
                  background: "#3b82f622", color: "#3b82f6",
                  textDecoration: "none", fontWeight: 600,
                }}>
                  Run
                </Link>
              </div>
            ))}
          </DataCard>
        </div>
      )}

      {/* Quick Nav */}
      <div className="section">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {[
            { href: "/anniversaries", label: "Anniversaries", icon: "\u2605" },
            { href: "/sops", label: "All SOPs", icon: "\u2611" },
            { href: "/donors", label: "Donors", icon: "\u2665" },
            ...(isAdmin
              ? [
                  { href: "/orders", label: "Orders", icon: "\u2692" },
                  { href: "/designs", label: "Designs", icon: "\u270E" },
                  { href: "/bracelets", label: "Pipeline", icon: "\u25CB" },
                  { href: "/laser", label: "Laser", icon: "\u2604" },
                  { href: "/volunteers", label: "Team", icon: "\u263A" },
                ]
              : []),
          ].map((link) => (
            <Link key={link.href} href={link.href} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 8,
              background: "var(--card-bg)", border: "1px solid var(--card-border)",
              textDecoration: "none", color: "var(--text-bright)", fontSize: 13,
            }}>
              <span style={{ fontSize: 16 }}>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

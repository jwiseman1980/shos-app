import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import { getHeroStats, getAnniversariesThisMonth } from "@/lib/data/heroes";
import { getSopStats, getSops } from "@/lib/data/sops";
import { getVolunteerStats } from "@/lib/data/volunteers";
import { getMonthName, getCurrentMonth, getCurrentYear, getDayOfMonth, yearsSince } from "@/lib/dates";
import Link from "next/link";

export default async function DashboardPage() {
  const heroStats = await getHeroStats();
  const sopStats = await getSopStats();
  const volunteerStats = await getVolunteerStats();
  const thisMonthHeroes = await getAnniversariesThisMonth();
  const allSops = await getSops();

  const month = getCurrentMonth();
  const year = getCurrentYear();
  const monthName = getMonthName(month);

  // Sort heroes by day of month
  const sortedHeroes = [...thisMonthHeroes].sort((a, b) => {
    const dayA = getDayOfMonth(a.memorialDate) || 0;
    const dayB = getDayOfMonth(b.memorialDate) || 0;
    return dayA - dayB;
  });

  // Group SOPs by domain
  const sopsByDomain = {};
  for (const sop of allSops) {
    if (!sopsByDomain[sop.domain]) sopsByDomain[sop.domain] = [];
    sopsByDomain[sop.domain].push(sop);
  }

  // Top branch counts
  const branchEntries = Object.entries(heroStats.branchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <PageShell
      title="Operations Dashboard"
      subtitle={`${monthName} ${year} — Steel Hearts Foundation`}
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Heroes Honored"
          value={heroStats.total}
          note={`${heroStats.active} with active listings`}
          accent="var(--gold)"
        />
        <StatBlock
          label={`${monthName} Anniversaries`}
          value={heroStats.thisMonth}
          note="This month's remembrances"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Active SOPs"
          value={sopStats.total}
          note={`${sopStats.domains.length} domains`}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Team Members"
          value={volunteerStats.total}
          note={`${volunteerStats.internal} volunteers + ${volunteerStats.external} external`}
          accent="var(--status-purple)"
        />
      </div>

      <div className="grid-2">
        {/* This Month's Anniversaries */}
        <DataCard title={`${monthName} Anniversaries (${sortedHeroes.length})`}>
          {sortedHeroes.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>No anniversaries this month.</p>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {sortedHeroes.map((hero) => {
                const day = getDayOfMonth(hero.memorialDate);
                const years = yearsSince(hero.memorialDate);
                return (
                  <div key={hero.sfId} className="list-item">
                    <div>
                      <div className="list-item-title">
                        {hero.rank} {hero.fullName.replace(/\s*\(.*?\)\s*/, "")}
                      </div>
                      <div className="list-item-sub">
                        {monthName} {day} &middot; {years} years &middot; {hero.serviceCode}
                      </div>
                    </div>
                    {hero.charityName && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {hero.charityName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>

        {/* SOP Overview */}
        <DataCard title="SOP Registry">
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {Object.entries(sopsByDomain).map(([domain, sops]) => (
              <div key={domain} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {domain}
                </div>
                {sops.map((sop) => (
                  <div key={sop.id} className="list-item">
                    <div>
                      <div className="list-item-title">{sop.id}: {sop.title}</div>
                      <div className="list-item-sub">{sop.version} &middot; {sop.cadence}</div>
                    </div>
                    <StatusBadge status={sop.status} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Branch Distribution */}
      <div className="section" style={{ marginTop: 24 }}>
        <DataCard title="Service Branch Distribution">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {branchEntries.map(([code, count]) => (
              <div key={code} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-bright)" }}>{count}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{code}</div>
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Quick Links */}
      <div className="section">
        <div className="section-title">Quick Navigation</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { href: "/anniversaries", label: "Anniversary Tracker", desc: "Track this month's remembrances" },
            { href: "/sops", label: "SOP Runner", desc: "Execute operational procedures" },
            { href: "/bracelets", label: "Bracelet Pipeline", desc: "Commission & fulfillment tracking" },
            { href: "/email", label: "Email Composer", desc: "Anniversary email drafts" },
            { href: "/content", label: "Content Generator", desc: "Social media post templates" },
            { href: "/volunteers", label: "Volunteer Portal", desc: "Team tasks & assignments" },
          ].map((link) => (
            <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
              <div className="card" style={{ cursor: "pointer", padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)", marginBottom: 4 }}>{link.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{link.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

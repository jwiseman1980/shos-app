import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import { getHeroes } from "@/lib/data/heroes";
import { getVolunteers } from "@/lib/data/volunteers";
import { getCurrentYear } from "@/lib/dates";

export default async function FinancePage() {
  const heroes = await getHeroes();
  const volunteers = await getVolunteers();
  const year = getCurrentYear();

  // Compute donation stats from hero data
  const hasDonationData = heroes.some((h) => h.totalDonations > 0);
  const totalDonations = heroes.reduce((sum, h) => sum + (h.totalDonations || 0), 0);
  const heroesWithDonations = heroes.filter((h) => (h.totalDonations || 0) > 0);
  const avgDonation = heroesWithDonations.length > 0
    ? totalDonations / heroesWithDonations.length
    : 0;

  // Top heroes by donation amount
  const topHeroes = [...heroes]
    .filter((h) => (h.totalDonations || 0) > 0)
    .sort((a, b) => (b.totalDonations || 0) - (a.totalDonations || 0))
    .slice(0, 15);

  // Donations by branch
  const branchDonations = {};
  for (const h of heroes) {
    if ((h.totalDonations || 0) > 0) {
      const code = h.serviceCode || "Unknown";
      if (!branchDonations[code]) branchDonations[code] = { total: 0, count: 0 };
      branchDonations[code].total += h.totalDonations || 0;
      branchDonations[code].count += 1;
    }
  }

  // Top charities by donation
  const charityDonations = {};
  for (const h of heroes) {
    if ((h.totalDonations || 0) > 0 && h.charityName) {
      if (!charityDonations[h.charityName]) charityDonations[h.charityName] = 0;
      charityDonations[h.charityName] += h.totalDonations || 0;
    }
  }
  const topCharities = Object.entries(charityDonations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Finance team
  const financeTeam = volunteers.filter(
    (v) => v.domains?.includes("Finance") || v.domains?.includes("All")
  );

  return (
    <PageShell
      title="Financial Dashboard"
      subtitle={`${year} — Donation Tracking & Charity Obligations`}
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Total Donations Raised"
          value={hasDonationData ? `$${totalDonations.toLocaleString()}` : "\u2014"}
          note={hasDonationData ? `Across ${heroesWithDonations.length} heroes` : "Connect Salesforce for live data"}
          accent="var(--gold)"
        />
        <StatBlock
          label="Avg per Hero"
          value={hasDonationData ? `$${Math.round(avgDonation).toLocaleString()}` : "\u2014"}
          note="Heroes with donations"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Active Listings"
          value={heroes.filter((h) => h.activeListing).length}
          note="Currently raising funds"
          accent="var(--status-green)"
        />
        <StatBlock
          label="Charity Partners"
          value={Object.keys(charityDonations).length || "\u2014"}
          note="Receiving organizations"
          accent="var(--status-purple)"
        />
      </div>

      <div className="grid-2">
        {/* Top Heroes by Donation */}
        <DataCard title="Top Heroes by Donations Raised">
          {!hasDonationData ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 4 }}>
                Donation data requires Salesforce connection
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Set SF_LIVE=true to see real-time financial data
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 450, overflowY: "auto" }}>
              {topHeroes.map((hero, i) => {
                const cleanName = hero.fullName
                  ? hero.fullName.replace(/\s*\(.*?\)\s*/, "")
                  : hero.name;
                return (
                  <div key={hero.sfId} className="list-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: i < 3 ? "var(--gold)" : "var(--card-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: i < 3 ? "#000" : "var(--text-dim)",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <div className="list-item-title">{cleanName}</div>
                        <div className="list-item-sub">
                          {hero.serviceCode}
                          {hero.charityName && ` \u00b7 ${hero.charityName}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-green)", whiteSpace: "nowrap" }}>
                      ${(hero.totalDonations || 0).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>

        {/* Top Charities */}
        <DataCard title="Top Charity Recipients">
          {topCharities.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
                No charity donation data available
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 450, overflowY: "auto" }}>
              {topCharities.map(([name, amount], i) => (
                <div key={name} className="list-item">
                  <div>
                    <div className="list-item-title">{name}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-green)", whiteSpace: "nowrap" }}>
                    ${amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      </div>

      {/* Donations by Branch */}
      <div className="section" style={{ marginTop: 24 }}>
        <DataCard title="Donations by Service Branch">
          {Object.keys(branchDonations).length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              Branch donation breakdown requires live Salesforce data.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {Object.entries(branchDonations)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([code, data]) => (
                  <div key={code} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--status-green)" }}>
                      ${data.total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {code}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                      {data.count} heroes
                    </div>
                  </div>
                ))}
            </div>
          )}
        </DataCard>
      </div>

      {/* Finance Team & QuickBooks Note */}
      <div className="grid-2">
        <DataCard title="Finance Team">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {financeTeam.map((v) => (
              <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: v.color || "var(--text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {v.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {v.role}
                    {v.isExternal && " (External)"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="QuickBooks Integration">
          <div style={{ padding: "12px 0" }}>
            <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>
              Financial records are managed in QuickBooks Online.
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}><strong>Chart of accounts:</strong> Managed by Sara Curran</div>
              <div style={{ marginBottom: 4 }}><strong>Bank reconciliation:</strong> Monthly</div>
              <div style={{ marginBottom: 4 }}><strong>Relevant SOPs:</strong> SOP-FIN-001, SOP-FIN-002</div>
            </div>
            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", fontSize: 11, color: "var(--text-dim)" }}>
              API integration planned for future phase. Currently manual import.
            </div>
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}

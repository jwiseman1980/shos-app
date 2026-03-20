import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import { getSops, getSopStats } from "@/lib/data/sops";

export default async function SopsPage() {
  const sops = await getSops();
  const stats = await getSopStats();

  const byDomain = {};
  for (const sop of sops) {
    if (!byDomain[sop.domain]) byDomain[sop.domain] = [];
    byDomain[sop.domain].push(sop);
  }

  return (
    <PageShell
      title="SOP Runner"
      subtitle={`${stats.total} procedures across ${stats.domains.length} domains`}
    >
      <div className="stat-grid">
        <div className="stat-block" style={{ borderTop: "2px solid var(--gold)" }}>
          <div className="stat-label">Total SOPs</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-green)" }}>
          <div className="stat-label">Daily</div>
          <div className="stat-value">{stats.dailyCount}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-blue)" }}>
          <div className="stat-label">Monthly</div>
          <div className="stat-value">{stats.monthlyCount}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-purple)" }}>
          <div className="stat-label">Domains</div>
          <div className="stat-value">{stats.domains.length}</div>
        </div>
      </div>

      {Object.entries(byDomain).map(([domain, domainSops]) => (
        <div key={domain} className="section">
          <div className="section-title">{domain}</div>
          {domainSops.map((sop) => (
            <DataCard key={sop.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
                    {sop.id}: {sop.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>
                    {sop.summary}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {sop.version} &middot; {sop.cadence} &middot; Owner: {sop.owner}
                  </div>
                </div>
                <StatusBadge status={sop.status} />
              </div>
            </DataCard>
          ))}
        </div>
      ))}
    </PageShell>
  );
}

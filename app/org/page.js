import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import { getVolunteers } from "@/lib/data/volunteers";
import { getSopStats } from "@/lib/data/sops";

export default async function OrgPage() {
  const volunteers = await getVolunteers();
  const sopStats = await getSopStats();
  const founder = volunteers.find((v) => v.isFounder);
  const vols = volunteers.filter((v) => !v.isFounder && !v.isExternal);
  const external = volunteers.filter((v) => v.isExternal);

  return (
    <PageShell title="Org Chart" subtitle="Steel Hearts team structure and governance">
      <div className="stat-grid">
        <div className="stat-block" style={{ borderTop: "2px solid var(--gold)" }}>
          <div className="stat-label">Founder</div>
          <div className="stat-value">1</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-green)" }}>
          <div className="stat-label">Volunteers</div>
          <div className="stat-value">{vols.length}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-blue)" }}>
          <div className="stat-label">External Partners</div>
          <div className="stat-value">{external.length}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-purple)" }}>
          <div className="stat-label">Active SOPs</div>
          <div className="stat-value">{sopStats.total}</div>
        </div>
      </div>

      {founder && (
        <div className="section">
          <div className="section-title">Leadership</div>
          <DataCard>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: founder.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                {founder.initials}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, color: "var(--text-bright)" }}>{founder.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{founder.role}</div>
                <div style={{ fontSize: 12, color: "var(--gold)" }}>{founder.email}</div>
              </div>
            </div>
          </DataCard>
        </div>
      )}

      <div className="section">
        <div className="section-title">Volunteers</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {vols.map((v) => (
            <DataCard key={v.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: v.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                  {v.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-bright)" }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{v.role}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{v.domains.join(", ")}</div>
                </div>
              </div>
            </DataCard>
          ))}
        </div>
      </div>

      {external.length > 0 && (
        <div className="section">
          <div className="section-title">External Partners</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {external.map((v) => (
              <DataCard key={v.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: v.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                    {v.initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-bright)" }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{v.role}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{v.domains.join(", ")}</div>
                  </div>
                </div>
              </DataCard>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import StatBlock from "@/components/StatBlock";
import { getSops, getSopStats } from "@/lib/data/sops";
import SopLastRun from "@/components/SopLastRun";
import SopRunHistory from "@/components/SopRunHistory";
import Link from "next/link";

export default async function SopsPage() {
  const sops = await getSops();
  const stats = await getSopStats();

  const byDomain = {};
  for (const sop of sops) {
    if (!byDomain[sop.domain]) byDomain[sop.domain] = [];
    byDomain[sop.domain].push(sop);
  }

  const procedureCount = sops.filter((s) => s.type === "procedure").length;
  const referenceCount = sops.filter((s) => s.type === "reference").length;

  return (
    <PageShell
      title="SOP Runner"
      subtitle={`${stats.total} procedures across ${stats.domains.length} domains`}
    >
      <div className="stat-grid">
        <StatBlock
          label="Total SOPs"
          value={stats.total}
          note={`${procedureCount} runnable, ${referenceCount} reference`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Daily"
          value={stats.dailyCount}
          note="Runs every day"
          accent="var(--status-green)"
        />
        <StatBlock
          label="Monthly"
          value={stats.monthlyCount}
          note="Monthly cadence"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Domains"
          value={stats.domains.length}
          note="Operational areas"
          accent="var(--status-purple)"
        />
      </div>

      {Object.entries(byDomain).map(([domain, domainSops]) => (
        <div key={domain} className="section">
          <div className="section-title">{domain}</div>
          {domainSops.map((sop) => {
            const isRunnable = sop.type === "procedure" && sop.steps && sop.steps.length > 0;
            return (
              <Link
                key={sop.id}
                href={`/sops/${encodeURIComponent(sop.id)}`}
                style={{ textDecoration: "none", display: "block", marginBottom: 8 }}
              >
                <div
                  className="card"
                  style={{
                    padding: 16,
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)" }}>
                          {sop.id}: {sop.title}
                        </div>
                        {isRunnable && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--gold)",
                              color: "#000",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Runnable
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>
                        {sop.summary}
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, color: "var(--text-dim)" }}>
                        <span>{sop.version}</span>
                        <span style={{ opacity: 0.4 }}>&middot;</span>
                        <span>{sop.cadence}</span>
                        <span style={{ opacity: 0.4 }}>&middot;</span>
                        <span>{sop.owner}</span>
                        {isRunnable && (
                          <>
                            <span style={{ opacity: 0.4 }}>&middot;</span>
                            <span style={{ color: "var(--gold)" }}>{sop.steps.length} steps</span>
                          </>
                        )}
                        <SopLastRun sopId={sop.id} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                      <StatusBadge status={sop.status} />
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4 }}>
                        <path
                          d="M6 4L10 8L6 12"
                          stroke="var(--text-dim)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ))}
      {/* Run History */}
      <div className="section" style={{ marginTop: 24 }}>
        <DataCard title="Run History">
          <SopRunHistory />
        </DataCard>
      </div>
    </PageShell>
  );
}

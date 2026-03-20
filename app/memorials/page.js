import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import { getHeroes, getHeroStats } from "@/lib/data/heroes";

export default async function MemorialsPage() {
  const heroes = await getHeroes();
  const stats = await getHeroStats();

  // Sort alphabetically by last name
  const sorted = [...heroes].sort((a, b) => {
    const lastA = a.lastName || a.fullName?.split(" ").pop() || "";
    const lastB = b.lastName || b.fullName?.split(" ").pop() || "";
    return lastA.localeCompare(lastB);
  });

  // Group by first letter
  const grouped = {};
  for (const hero of sorted) {
    const lastName = hero.lastName || hero.fullName?.split(" ").pop() || "?";
    const letter = lastName.charAt(0).toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(hero);
  }

  // Heroes with bio pages vs without
  const withBio = heroes.filter((h) => h.bioPage);
  const withoutBio = heroes.filter((h) => !h.bioPage);

  // Heroes with family contact vs without
  const withFamily = heroes.filter((h) => h.familyContactId);
  const withoutFamily = heroes.filter((h) => !h.familyContactId);

  return (
    <PageShell
      title="Memorial Registry"
      subtitle={`${stats.total} Heroes Honored — Full Registry`}
    >
      {/* Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Heroes Honored"
          value={stats.total}
          note={`${stats.active} with active listings`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Bio Pages"
          value={withBio.length}
          note={`${withoutBio.length} still needed`}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Family Connected"
          value={withFamily.length}
          note={`${withoutFamily.length} unlinked`}
          accent="var(--status-green)"
        />
        <StatBlock
          label="Service Branches"
          value={Object.keys(stats.branchCounts).length}
          note="Represented"
          accent="var(--status-purple)"
        />
      </div>

      {/* Branch Distribution */}
      <div className="section">
        <DataCard title="Service Branch Distribution">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {Object.entries(stats.branchCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([code, count]) => (
                <div key={code} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-bright)" }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {code}
                  </div>
                </div>
              ))}
          </div>
        </DataCard>
      </div>

      {/* Full Registry */}
      <div className="section">
        <DataCard title={`Full Registry (${sorted.length})`}>
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {Object.entries(grouped).map(([letter, letterHeroes]) => (
              <div key={letter} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--gold)",
                    borderBottom: "1px solid var(--card-border)",
                    paddingBottom: 4,
                    marginBottom: 6,
                    position: "sticky",
                    top: 0,
                    background: "var(--card-bg)",
                    zIndex: 1,
                  }}
                >
                  {letter}
                </div>
                {letterHeroes.map((hero) => {
                  const cleanName = hero.fullName
                    ? hero.fullName.replace(/\s*\(.*?\)\s*/, "")
                    : hero.name;
                  return (
                    <div key={hero.sfId} className="list-item">
                      <div style={{ flex: 1 }}>
                        <div className="list-item-title">
                          {hero.rank} {cleanName}
                        </div>
                        <div className="list-item-sub">
                          {hero.serviceCode}
                          {hero.memorialDate && ` \u00b7 ${hero.memorialDate}`}
                          {hero.charityName && ` \u00b7 ${hero.charityName}`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {hero.bioPage && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              background: "var(--status-blue)",
                              color: "#fff",
                              borderRadius: "var(--radius-sm)",
                              fontWeight: 600,
                            }}
                          >
                            BIO
                          </span>
                        )}
                        <StatusBadge
                          status={hero.activeListing ? "Active" : "Inactive"}
                          label={hero.activeListing ? "Active" : "Inactive"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Missing Data Summary */}
      <div className="grid-2">
        <DataCard title={`Missing Bio Pages (${withoutBio.length})`}>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {withoutBio.slice(0, 20).map((hero) => (
              <div key={hero.sfId} className="list-item">
                <div>
                  <div className="list-item-title">
                    {hero.rank} {hero.lastName || hero.fullName?.split(" ").pop()}
                  </div>
                  <div className="list-item-sub">{hero.serviceCode}</div>
                </div>
              </div>
            ))}
            {withoutBio.length > 20 && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "8px 16px" }}>
                + {withoutBio.length - 20} more
              </div>
            )}
          </div>
        </DataCard>

        <DataCard title={`Missing Family Link (${withoutFamily.length})`}>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {withoutFamily.slice(0, 20).map((hero) => (
              <div key={hero.sfId} className="list-item">
                <div>
                  <div className="list-item-title">
                    {hero.rank} {hero.lastName || hero.fullName?.split(" ").pop()}
                  </div>
                  <div className="list-item-sub">{hero.serviceCode}</div>
                </div>
              </div>
            ))}
            {withoutFamily.length > 20 && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "8px 16px" }}>
                + {withoutFamily.length - 20} more
              </div>
            )}
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}

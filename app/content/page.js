import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import StatusBadge from "@/components/StatusBadge";
import { getAnniversariesThisMonth, getHeroStats } from "@/lib/data/heroes";
import { getMonthName, getCurrentMonth, getCurrentYear, getDayOfMonth, yearsSince } from "@/lib/dates";

const BRANCH_HASHTAGS = {
  USA: ["#USArmy", "#ArmyStrong", "#ThisWeWillDefend"],
  USMA: ["#WestPoint", "#USMA", "#DutyHonorCountry", "#LongGrayLine"],
  USMC: ["#USMC", "#Marines", "#SemperFi", "#DevilDogs"],
  USN: ["#USNavy", "#Navy", "#NonSibiSedPatriae"],
  USAF: ["#USAF", "#AirForce", "#AimHigh"],
  USAFA: ["#USAFA", "#AirForceAcademy", "#AimHigh"],
  USCG: ["#USCG", "#CoastGuard", "#SemperParatus"],
  USSF: ["#SpaceForce", "#USSF", "#SemperSupra"],
};

const CORE_HASHTAGS = [
  "#SteelHearts",
  "#NeverForget",
  "#GoldStarFamily",
  "#HonorTheFallen",
  "#MemorialBracelet",
];

export default async function ContentPage() {
  const heroes = await getAnniversariesThisMonth();
  const stats = await getHeroStats();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const monthName = getMonthName(month);

  // Sort by day
  const sorted = [...heroes].sort((a, b) => {
    const dayA = getDayOfMonth(a.memorialDate) || 0;
    const dayB = getDayOfMonth(b.memorialDate) || 0;
    return dayA - dayB;
  });

  // Group by week of month for content calendar
  const weeks = [[], [], [], [], []];
  for (const hero of sorted) {
    const day = getDayOfMonth(hero.memorialDate) || 1;
    const weekIdx = Math.min(Math.floor((day - 1) / 7), 4);
    weeks[weekIdx].push(hero);
  }

  return (
    <PageShell
      title="Content Generator"
      subtitle={`${monthName} ${year} — Social Media & Memorial Posts`}
    >
      {/* Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Posts This Month"
          value={sorted.length}
          note={`${monthName} anniversary memorials`}
          accent="var(--gold)"
        />
        <StatBlock
          label="Heroes Honored"
          value={stats.total}
          note="Total in registry"
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Service Branches"
          value={Object.keys(stats.branchCounts).length}
          note="Represented branches"
          accent="var(--status-purple)"
        />
        <StatBlock
          label="Active Listings"
          value={stats.active}
          note="With bracelet available"
          accent="var(--status-green)"
        />
      </div>

      {/* Content Calendar */}
      <div className="section">
        <DataCard title={`${monthName} Content Calendar`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {weeks.map((weekHeroes, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: "var(--bg)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Week {i + 1}
                </div>
                {weekHeroes.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>
                    No anniversaries
                  </div>
                ) : (
                  weekHeroes.map((hero) => {
                    const day = getDayOfMonth(hero.memorialDate);
                    return (
                      <div
                        key={hero.sfId}
                        style={{
                          fontSize: 12,
                          padding: "4px 0",
                          borderBottom: "1px solid var(--card-border)",
                        }}
                      >
                        <span style={{ color: "var(--gold)", fontWeight: 600 }}>{day}</span>
                        <span style={{ color: "var(--text)" }}> — {hero.rank} {hero.lastName || hero.fullName?.split(" ").pop()}</span>
                        <span style={{ color: "var(--text-dim)", fontSize: 10 }}> ({hero.serviceCode})</span>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </DataCard>
      </div>

      {/* Post Templates */}
      <div className="section">
        <DataCard title={`Memorial Post Templates (${sorted.length})`}>
          {sorted.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
              No anniversaries this month.
            </p>
          ) : (
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {sorted.map((hero) => {
                const day = getDayOfMonth(hero.memorialDate);
                const years = yearsSince(hero.memorialDate);
                const branchTags = BRANCH_HASHTAGS[hero.serviceCode] || [];
                const allTags = [...CORE_HASHTAGS, ...branchTags];
                const cleanName = hero.fullName
                  ? hero.fullName.replace(/\s*\(.*?\)\s*/, "")
                  : hero.name;

                return (
                  <div
                    key={hero.sfId}
                    style={{
                      padding: 16,
                      marginBottom: 12,
                      background: "var(--bg)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-bright)" }}>
                          {hero.rank} {cleanName}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                          {monthName} {day} &middot; {years} Year Anniversary &middot; {hero.branch || hero.serviceCode}
                        </div>
                      </div>
                      <StatusBadge status={hero.serviceCode} label={hero.serviceCode} />
                    </div>

                    {/* Generated Post Template */}
                    <div
                      style={{
                        padding: 12,
                        background: "var(--card-bg)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "var(--text)",
                        marginBottom: 8,
                        borderLeft: "3px solid var(--gold)",
                      }}
                    >
                      <div>
                        Today we honor and remember {hero.rank} {cleanName}, who made the ultimate sacrifice {years} years ago on {monthName} {day}.
                      </div>
                      <div style={{ marginTop: 8 }}>
                        Every bracelet purchased in {hero.rank} {hero.lastName || cleanName.split(" ").pop()}&apos;s honor generates a $10 donation to {hero.charityName || "their designated charity"}.
                      </div>
                      {hero.bioPage && (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          Learn more: {hero.bioPage}
                        </div>
                      )}
                    </div>

                    {/* Hashtags */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {allTags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            background: "var(--card-bg)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--status-blue)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DataCard>
      </div>

      {/* Hashtag Reference */}
      <div className="section">
        <DataCard title="Hashtag Reference by Branch">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {Object.entries(BRANCH_HASHTAGS).map(([code, tags]) => (
              <div key={code}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  {code}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        background: "var(--bg)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--status-blue)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      </div>
    </PageShell>
  );
}

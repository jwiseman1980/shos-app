import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatusBadge from "@/components/StatusBadge";
import { getAnniversariesThisMonth } from "@/lib/data/heroes";
import { getMonthName, getCurrentMonth, getCurrentYear, getDayOfMonth, yearsSince } from "@/lib/dates";

export default async function AnniversariesPage() {
  const heroes = await getAnniversariesThisMonth();
  const month = getCurrentMonth();
  const monthName = getMonthName(month);
  const year = getCurrentYear();

  const sorted = [...heroes].sort((a, b) => {
    return (getDayOfMonth(a.memorialDate) || 0) - (getDayOfMonth(b.memorialDate) || 0);
  });

  const today = new Date().getDate();

  return (
    <PageShell
      title="Anniversary Tracker"
      subtitle={`${monthName} ${year} — ${heroes.length} remembrances this month`}
    >
      <div className="stat-grid">
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-green)" }}>
          <div className="stat-label">Total This Month</div>
          <div className="stat-value">{heroes.length}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-orange)" }}>
          <div className="stat-label">Upcoming</div>
          <div className="stat-value">{sorted.filter(h => (getDayOfMonth(h.memorialDate) || 0) >= today).length}</div>
        </div>
        <div className="stat-block" style={{ borderTop: "2px solid var(--status-blue)" }}>
          <div className="stat-label">Past This Month</div>
          <div className="stat-value">{sorted.filter(h => (getDayOfMonth(h.memorialDate) || 0) < today).length}</div>
        </div>
      </div>

      <DataCard title={`${monthName} Anniversary Calendar`}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Hero</th>
              <th>Branch</th>
              <th>Years</th>
              <th>Charity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((hero) => {
              const day = getDayOfMonth(hero.memorialDate);
              const years = yearsSince(hero.memorialDate);
              const isPast = day < today;
              const isToday = day === today;
              return (
                <tr key={hero.sfId}>
                  <td style={{ fontWeight: isToday ? 700 : 400, color: isToday ? "var(--gold)" : isPast ? "var(--text-dim)" : "var(--text)" }}>
                    {monthName.slice(0, 3)} {day}
                  </td>
                  <td>
                    <span style={{ color: isPast ? "var(--text-dim)" : "var(--text-bright)" }}>
                      {hero.rank} {hero.fullName.replace(/\s*\(.*?\)\s*/, "")}
                    </span>
                  </td>
                  <td>{hero.serviceCode}</td>
                  <td>{years}</td>
                  <td style={{ fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {hero.charityName || "—"}
                  </td>
                  <td>
                    <StatusBadge status={isPast ? "sent" : isToday ? "in_progress" : "upcoming"} label={isPast ? "Past" : isToday ? "Today" : "Upcoming"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataCard>
    </PageShell>
  );
}

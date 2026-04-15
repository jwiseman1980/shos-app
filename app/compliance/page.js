import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import ComplianceTracker from "@/components/ComplianceTracker";
import { getComplianceItems, getComplianceStats } from "@/lib/data/compliance";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  let items = [];
  let stats = { total: 0, filed: 0, overdue: 0, dueSoon: 0, notStarted: 0 };

  try {
    [items, stats] = await Promise.all([getComplianceItems(), getComplianceStats()]);
  } catch (err) {
    console.error("Compliance page error:", err.message);
  }

  return (
    <PageShell
      title="Compliance Calendar"
      subtitle="Filing deadlines, state registrations, and governance requirements"
    >
      <div className="stat-grid">
        <StatBlock
          label="Total Items"
          value={stats.total || "--"}
          note="Tracked requirements"
          accent="var(--text-dim)"
        />
        <StatBlock
          label="Filed / Confirmed"
          value={stats.filed || "0"}
          note="Complete this cycle"
          accent="var(--status-green)"
        />
        <StatBlock
          label="Due Within 30 Days"
          value={stats.dueSoon || "0"}
          note="Action required soon"
          accent={stats.dueSoon > 0 ? "var(--status-orange)" : "var(--text-dim)"}
        />
        <StatBlock
          label="Overdue"
          value={stats.overdue || "0"}
          note="Past due date"
          accent={stats.overdue > 0 ? "var(--status-red)" : "var(--text-dim)"}
        />
      </div>
      <ComplianceTracker initialItems={items} />
    </PageShell>
  );
}

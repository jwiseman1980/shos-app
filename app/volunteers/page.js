export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import VolunteerList from "@/components/VolunteerList";
import { getVolunteers, getVolunteerStats } from "@/lib/data/volunteerData";

export default async function VolunteersPage() {
  let volunteers = [], stats = {};

  try {
    [volunteers, stats] = await Promise.all([
      getVolunteers(),
      getVolunteerStats(),
    ]);
  } catch (err) {
    console.error("Volunteers page load error:", err.message);
  }

  return (
    <PageShell title="Volunteers" subtitle="Team member management and onboarding">
      <div className="stat-grid">
        <StatBlock
          label="Active"
          value={stats.active || 0}
          note="Currently contributing"
          accent="#22c55e"
        />
        <StatBlock
          label="Onboarding"
          value={stats.onboarding || 0}
          note="In training"
          accent="#3b82f6"
        />
        <StatBlock
          label="Prospects"
          value={stats.prospect || 0}
          note="Not yet started"
          accent="#f59e0b"
        />
        <StatBlock
          label="Total"
          value={stats.total || 0}
          note={`${stats.inactive || 0} inactive`}
          accent="var(--gold)"
        />
      </div>

      <div className="section">
        <VolunteerList initialVolunteers={volunteers} />
      </div>
    </PageShell>
  );
}

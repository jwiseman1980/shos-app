export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import FamilyList from "@/components/FamilyList";
import { getFamilyContacts, getFamilyStats } from "@/lib/data/familyData";

export default async function FamiliesPage() {
  let contacts = [], stats = {};

  try {
    [contacts, stats] = await Promise.all([
      getFamilyContacts(),
      getFamilyStats(),
    ]);
  } catch (err) {
    console.error("Families page load error:", err.message);
  }

  return (
    <PageShell title="Families" subtitle="Gold Star family contacts and relationships">
      <div className="stat-grid">
        <StatBlock
          label="Total Contacts"
          value={stats.total || 0}
          note={`${stats.withEmail || 0} with email`}
          accent="#e74c3c"
        />
        <StatBlock
          label="Missing Email"
          value={stats.withoutEmail || 0}
          note="Need outreach info"
          accent="#f59e0b"
        />
        <StatBlock
          label="Hero Links"
          value={stats.heroLinks || 0}
          note="Contact-to-hero associations"
          accent="#3b82f6"
        />
        <StatBlock
          label="Coverage"
          value={stats.total > 0 ? Math.round((stats.withEmail / stats.total) * 100) + "%" : "—"}
          note="Contacts with email"
          accent="var(--gold)"
        />
      </div>

      <div className="section">
        <FamilyList initialContacts={contacts} />
      </div>
    </PageShell>
  );
}

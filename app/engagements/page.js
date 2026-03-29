export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import EngagementLog from "@/components/EngagementLog";
import { getServerClient } from "@/lib/supabase";

async function getEngagements() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("engagements")
    .select("*")
    .order("engagement_date", { ascending: false })
    .limit(100);
  if (error) return [];
  return data || [];
}

async function getEngagementStats() {
  const sb = getServerClient();
  const { data } = await sb.from("engagements").select("type, follow_up_needed");
  const items = data || [];
  return {
    total: items.length,
    followUps: items.filter(e => e.follow_up_needed).length,
    byType: items.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
  };
}

export default async function EngagementsPage() {
  let engagements = [], stats = {};

  try {
    [engagements, stats] = await Promise.all([getEngagements(), getEngagementStats()]);
  } catch (err) {
    console.error("Engagements page error:", err.message);
  }

  return (
    <PageShell title="Engagement Log" subtitle="Track interactions with contacts, partners, and organizations">
      <div className="stat-grid">
        <StatBlock label="Total Engagements" value={stats.total || 0} accent="var(--gold)" />
        <StatBlock label="Follow-ups Needed" value={stats.followUps || 0} accent="#f59e0b" note="Open action items" />
        <StatBlock label="Emails" value={stats.byType?.email || 0} accent="#3b82f6" />
        <StatBlock label="Partnerships" value={stats.byType?.partnership || 0} accent="#22c55e" />
      </div>
      <div className="section">
        <EngagementLog initialEngagements={engagements} />
      </div>
    </PageShell>
  );
}

export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import DataCard from "@/components/DataCard";
import StatBlock from "@/components/StatBlock";
import DesignQueue from "@/components/DesignQueue";

async function loadData() {
  if (!process.env.NOTION_API_KEY) {
    return { tasks: [], stats: { total: 0, active: 0, statusCounts: {} } };
  }
  const { getDesignTasks, getDesignStats } = await import("@/lib/data/designs");
  const [tasks, stats] = await Promise.all([getDesignTasks(), getDesignStats()]);
  return { tasks, stats };
}

export default async function DesignsPage() {
  const { tasks, stats } = await loadData();

  const activeTasks = tasks.filter((t) => t.status !== "Complete");
  const completedTasks = tasks.filter((t) => t.status === "Complete");

  return (
    <PageShell
      title="Graphic Design Queue"
      subtitle={`${stats.active} active design tasks`}
    >
      {/* KPI Stats */}
      <div className="stat-grid">
        <StatBlock
          label="Active Tasks"
          value={stats.active}
          accent="var(--gold)"
        />
        <StatBlock
          label="Not Started"
          value={stats.statusCounts?.["Not Started"] || 0}
          accent="var(--status-gray)"
        />
        <StatBlock
          label="In Progress"
          value={stats.statusCounts?.["In Progress"] || 0}
          accent="var(--status-blue)"
        />
        <StatBlock
          label="Completed"
          value={stats.statusCounts?.["Complete"] || 0}
          accent="var(--status-green)"
        />
      </div>

      {/* Active Design Tasks */}
      <DataCard title={`Active Design Tasks — ${activeTasks.length}`}>
        <DesignQueue tasks={activeTasks} />
      </DataCard>

      {/* How it works */}
      <DataCard title="How Design Tasks Work">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ padding: "12px 16px", background: "var(--bg)", border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", flex: "1 1 200px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
              1. Order Triggers Design
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
              When an order in the Order Queue has no existing bracelet design, mark it as "Design Needed" and click "+ Design Task" to add it here.
            </div>
          </div>
          <div style={{ padding: "12px 16px", background: "var(--bg)", border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", flex: "1 1 200px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
              2. Designer Works
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
              Assign a designer and update status to "In Progress." The designer creates the bracelet layout and uploads to Salesforce.
            </div>
          </div>
          <div style={{ padding: "12px 16px", background: "var(--bg)", border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", flex: "1 1 200px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginBottom: 4 }}>
              3. Ready for Production
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
              Once the design is complete, mark it "Complete" here. Then update the associated order to "Ready to Laser" in the Order Queue.
            </div>
          </div>
        </div>
      </DataCard>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <DataCard title={`Completed Designs — ${completedTasks.length}`}>
          <DesignQueue tasks={completedTasks} />
        </DataCard>
      )}

      {!process.env.NOTION_API_KEY && (
        <DataCard title="Setup Required">
          <p style={{ color: "var(--status-orange)", fontSize: 13 }}>
            Notion API key not configured. Add NOTION_API_KEY to your environment variables to connect
            the Graphic Design Tracker from Notion.
          </p>
        </DataCard>
      )}
    </PageShell>
  );
}

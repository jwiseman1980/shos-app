export const dynamic = "force-dynamic";

import PageShell from "@/components/PageShell";
import StatBlock from "@/components/StatBlock";
import TaskBoard from "@/components/TaskBoard";
import { getTasks, getTaskStats } from "@/lib/data/tasks";

export default async function TasksPage() {
  let tasks = [], stats = {};

  try {
    [tasks, stats] = await Promise.all([
      getTasks({ includeCompleted: false }),
      getTaskStats(),
    ]);
  } catch (err) {
    console.error("Tasks page load error:", err.message);
  }

  return (
    <PageShell title="Tasks" subtitle="Cross-role task management — assign, track, complete">
      <div className="stat-grid">
        <StatBlock
          label="To Do"
          value={stats.todo || 0}
          note={`${stats.backlog || 0} in backlog`}
          accent="#f59e0b"
        />
        <StatBlock
          label="In Progress"
          value={stats.inProgress || 0}
          note={`${stats.blocked || 0} blocked`}
          accent="#3b82f6"
        />
        <StatBlock
          label="Completed"
          value={stats.done || 0}
          note="All time"
          accent="#22c55e"
        />
        <StatBlock
          label="Total Active"
          value={(stats.total || 0) - (stats.done || 0)}
          note={`${stats.byPriority?.critical || 0} critical \u00b7 ${stats.byPriority?.high || 0} high`}
          accent="var(--gold)"
        />
      </div>

      <div className="section">
        <TaskBoard initialTasks={tasks} />
      </div>
    </PageShell>
  );
}

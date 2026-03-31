"use client";

/**
 * Task Sidebar — unified daily task list (calendar events + queue items merged).
 *
 * Shows today's tasks priority-ordered, with status indicators.
 * Tomorrow+ shown in compact section below.
 * Collapsible — click the toggle chevron on the border to collapse/expand.
 */
export default function TaskSidebar({
  tasks,
  activeTaskId,
  onTaskClick,
  onViewChange,
  activeView,
  emailCount,
  greeting,
  collapsed,
  onToggleCollapse,
}) {
  const today = new Date().toISOString().split("T")[0];

  const todayTasks = tasks.filter((t) => {
    if (t.status === "done") return true;
    if (t.date === today || !t.date) return true;
    return false;
  });

  const futureTasks = tasks.filter((t) => t.date && t.date > today && t.status !== "done");

  const statusIcon = (task) => {
    if (task.status === "done") return "\u2713";
    if (task.status === "active") return "\u25cf";
    return "\u25cb";
  };

  const statusColor = (task) => {
    if (task.status === "done") return "#27ae60";
    if (task.status === "active") return "#c4a237";
    return "var(--text-dim)";
  };

  // Collapsed: just a narrow strip with the toggle button
  if (collapsed) {
    return (
      <div className="task-sidebar task-sidebar--collapsed">
        <button
          className="task-sidebar-toggle task-sidebar-toggle--expand"
          onClick={onToggleCollapse}
          title="Expand task sidebar"
        >
          &#8250;
        </button>
        {emailCount > 0 && (
          <div className="task-sidebar-collapsed-badge">{emailCount}</div>
        )}
      </div>
    );
  }

  return (
    <div className="task-sidebar">
      {/* Header */}
      <div className="task-sidebar-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-bright)" }}>
              {greeting}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
          <button
            className="task-sidebar-toggle"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
          >
            &#8249;
          </button>
        </div>
      </div>

      {/* Email triage button */}
      {emailCount > 0 && (
        <button
          className={`task-sidebar-email-btn ${activeView === "email-triage" ? "active" : ""}`}
          onClick={() => onViewChange("email-triage")}
        >
          <span style={{ fontSize: 14 }}>&#9993;</span>
          <span>Email Triage</span>
          <span className="task-sidebar-badge">{emailCount}</span>
        </button>
      )}

      {/* Today */}
      <div className="task-sidebar-section">Today</div>

      <div className="task-sidebar-list">
        {todayTasks.length === 0 && (
          <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>
            No tasks for today
          </div>
        )}
        {todayTasks.map((task) => (
          <button
            key={task.id}
            className={`task-sidebar-item ${activeTaskId === task.id ? "active" : ""} ${task.status === "done" ? "done" : ""}`}
            onClick={() => onTaskClick(task)}
          >
            <span className="task-sidebar-status" style={{ color: statusColor(task) }}>
              {statusIcon(task)}
            </span>
            <div className="task-sidebar-item-content">
              <div className="task-sidebar-item-title">{task.title}</div>
              <div className="task-sidebar-item-meta">
                {task.time && <span>{task.time}</span>}
                {task.estimatedMinutes && <span>{task.estimatedMinutes}m</span>}
                {task.assignee &&
                  task.assignee !== "Joseph" &&
                  !task.assignee.includes("-") && (
                    <span className="task-sidebar-assignee">{task.assignee}</span>
                  )}
              </div>
            </div>
            {task.source === "calendar" && (
              <span className="task-sidebar-cal-dot" title="Calendar event" />
            )}
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {futureTasks.length > 0 && (
        <>
          <div className="task-sidebar-section">Upcoming</div>
          <div className="task-sidebar-list">
            {futureTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="task-sidebar-item future">
                <span className="task-sidebar-status" style={{ color: "var(--text-dim)" }}>
                  {statusIcon(task)}
                </span>
                <div className="task-sidebar-item-content">
                  <div className="task-sidebar-item-title">{task.title}</div>
                  <div className="task-sidebar-item-meta">
                    <span>
                      {new Date(task.date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

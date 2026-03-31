"use client";

/**
 * Task Sidebar — unified daily task list (calendar events + queue items merged).
 *
 * Shows today's tasks priority-ordered, with status indicators.
 * Tomorrow+ shown in compact section below.
 */
export default function TaskSidebar({
  tasks,
  activeTaskId,
  onTaskClick,
  onViewChange,
  activeView,
  emailCount,
  greeting,
}) {
  const today = new Date().toISOString().split("T")[0];

  const todayTasks = tasks.filter((t) => {
    if (t.status === "done") return true; // show completed for the day
    if (t.date === today || !t.date) return true; // today or unscheduled
    return false;
  });

  const futureTasks = tasks.filter((t) => t.date && t.date > today && t.status !== "done");

  const statusIcon = (task) => {
    if (task.status === "done") return "\u2713"; // checkmark
    if (task.status === "active") return "\u25cf"; // filled circle
    return "\u25cb"; // empty circle
  };

  const statusColor = (task) => {
    if (task.status === "done") return "#27ae60";
    if (task.status === "active") return "#c4a237";
    return "var(--text-dim)";
  };

  return (
    <div className="task-sidebar">
      {/* Header */}
      <div className="task-sidebar-header">
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-bright)" }}>
          {greeting}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Email triage button (if emails exist) */}
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

      {/* Today section label */}
      <div className="task-sidebar-section">Today</div>

      {/* Today's tasks */}
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
            <span
              className="task-sidebar-status"
              style={{ color: statusColor(task) }}
            >
              {statusIcon(task)}
            </span>
            <div className="task-sidebar-item-content">
              <div className="task-sidebar-item-title">{task.title}</div>
              <div className="task-sidebar-item-meta">
                {task.time && <span>{task.time}</span>}
                {task.estimatedMinutes && <span>{task.estimatedMinutes}m</span>}
                {task.assignee && task.assignee !== "Joseph" && !task.assignee.includes("-") && (
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

      {/* Future section */}
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
                    <span>{new Date(task.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
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

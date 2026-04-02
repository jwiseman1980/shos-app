"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/",              label: "Dashboard",     icon: "⊞" },
  { href: "/orders",        label: "Orders",        icon: "◈" },
  { href: "/laser",         label: "Laser",         icon: "◉" },
  { href: "/designs",       label: "Designs",       icon: "◇" },
  { href: "/shipping",      label: "Shipping",      icon: "↗" },
  { href: "/finance",       label: "Finance",       icon: "$" },
  { href: "/anniversaries", label: "Anniversaries", icon: "♡" },
  { href: "/families",      label: "Families",      icon: "⊛" },
  { href: "/sops",          label: "SOPs",          icon: "≡" },
];

// Group definitions: key, label, defaultExpanded
const TASK_GROUPS = [
  { key: "anniversary", label: "Family Outreach", defaultExpanded: true },
  { key: "task",        label: "Tasks",           defaultExpanded: true },
  { key: "sop",         label: "Daily Recurring", defaultExpanded: false },
  { key: "donation",    label: "Donors",          defaultExpanded: false },
  { key: "calendar",    label: "Calendar",        defaultExpanded: true },
];

/**
 * Task Sidebar — unified daily task list (calendar events + queue items merged).
 *
 * Groups tasks by source type with collapsible sections.
 * Filters out past calendar events and tasks assigned to others.
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
  isFounder,
}) {
  const pathname = usePathname();
  const today = new Date().toISOString().split("T")[0];
  const nowHour = new Date().getHours();
  const nowMin = new Date().getMinutes();

  // Filter: active today tasks (not done, not past calendar events)
  const todayActive = tasks.filter((t) => {
    if (t.status === "done") return false;
    // Past calendar events: if it has a time and it's already passed
    if (t.source === "calendar" && t.time) {
      const [h, m] = t.time.replace(/[^\d:]/g, "").split(":").map(Number);
      if (!isNaN(h) && (h < nowHour || (h === nowHour && (m || 0) < nowMin))) return false;
    }
    if (t.date && t.date > today) return false;
    return t.date === today || !t.date;
  });

  const doneTasks = tasks.filter((t) => t.status === "done" && (t.date === today || !t.date));
  const futureTasks = tasks.filter((t) => t.date && t.date > today && t.status !== "done");

  // Collapsed section state
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {};
    for (const g of TASK_GROUPS) initial[g.key] = g.defaultExpanded;
    initial.done = false;
    return initial;
  });

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group active tasks by sourceType
  const grouped = {};
  for (const t of todayActive) {
    const key = t.sourceType || (t.source === "calendar" ? "calendar" : "task");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

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

      {/* Nav */}
      <div className="task-sidebar-nav">
        {NAV_LINKS.map((link) => {
          const isActive = link.href === "/"
            ? pathname === "/" || pathname === ""
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`task-sidebar-nav-item${isActive ? " active" : ""}`}
            >
              <span className="task-sidebar-nav-icon">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}
        {isFounder && (
          <Link
            href="/gyst/properties"
            className={`task-sidebar-nav-item${pathname.startsWith("/gyst") ? " active" : ""}`}
          >
            <span className="task-sidebar-nav-icon">{"⊕"}</span>
            <span>GYST</span>
          </Link>
        )}
      </div>

      {/* Grouped task sections */}
      {todayActive.length === 0 && (
        <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>
          No tasks for today
        </div>
      )}

      {TASK_GROUPS.map((group) => {
        const items = grouped[group.key];
        if (!items?.length) return null;
        const isExpanded = expandedGroups[group.key];
        return (
          <div key={group.key}>
            <button
              className="task-sidebar-section"
              onClick={() => toggleGroup(group.key)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", background: "none", border: "none", cursor: "pointer",
                padding: "8px 12px 4px", textAlign: "left",
              }}
            >
              <span>{group.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 400 }}>{items.length}</span>
                <span style={{ fontSize: 10, color: "var(--text-dim)", transition: "transform 0.15s", transform: isExpanded ? "rotate(0)" : "rotate(-90deg)" }}>&#9660;</span>
              </span>
            </button>
            {isExpanded && (
              <div className="task-sidebar-list">
                {items.map((task) => (
                  <button
                    key={task.id}
                    className={`task-sidebar-item ${activeTaskId === task.id ? "active" : ""}`}
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
            )}
          </div>
        );
      })}

      {/* Completed */}
      {doneTasks.length > 0 && (
        <div>
          <button
            className="task-sidebar-section"
            onClick={() => toggleGroup("done")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", background: "none", border: "none", cursor: "pointer",
              padding: "8px 12px 4px", textAlign: "left",
            }}
          >
            <span>Completed</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 400 }}>{doneTasks.length}</span>
              <span style={{ fontSize: 10, color: "var(--text-dim)", transition: "transform 0.15s", transform: expandedGroups.done ? "rotate(0)" : "rotate(-90deg)" }}>&#9660;</span>
            </span>
          </button>
          {expandedGroups.done && (
            <div className="task-sidebar-list">
              {doneTasks.map((task) => (
                <button
                  key={task.id}
                  className={`task-sidebar-item done`}
                  onClick={() => onTaskClick(task)}
                >
                  <span className="task-sidebar-status" style={{ color: "#27ae60" }}>
                    &#10003;
                  </span>
                  <div className="task-sidebar-item-content">
                    <div className="task-sidebar-item-title">{task.title}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming */}
      {futureTasks.length > 0 && (
        <>
          <div className="task-sidebar-section" style={{ padding: "8px 12px 4px" }}>Upcoming</div>
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

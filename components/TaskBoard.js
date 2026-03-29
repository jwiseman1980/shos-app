"use client";

import { useState } from "react";

const ROLE_COLORS = {
  ed: "#c4a237", cos: "#b0b8c4", cfo: "#27ae60", coo: "#e67e22",
  comms: "#8e44ad", dev: "#3498db", family: "#e74c3c", architect: "#6b7280",
};

const ROLE_LABELS = {
  ed: "ED", cos: "COS", cfo: "CFO", coo: "COO",
  comms: "Comms", dev: "Dev", family: "Family", architect: "CTO",
};

const PRIORITY_COLORS = {
  critical: { bg: "#ef444433", text: "#ef4444" },
  high: { bg: "#f59e0b33", text: "#f59e0b" },
  medium: { bg: "#3b82f633", text: "#3b82f6" },
  low: { bg: "#6b728033", text: "#6b7280" },
};

const STATUS_COLUMNS = [
  { key: "backlog", label: "Backlog", color: "#6b7280" },
  { key: "todo", label: "To Do", color: "#f59e0b" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "blocked", label: "Blocked", color: "#ef4444" },
  { key: "done", label: "Done", color: "#22c55e" },
];

const STATUS_OPTIONS = ["backlog", "todo", "in_progress", "blocked", "done", "cancelled"];
const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"];
const ROLE_OPTIONS = ["ed", "cos", "cfo", "coo", "comms", "dev", "family", "architect"];

function PriorityBadge({ priority }) {
  const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 8,
      fontSize: 10, fontWeight: 600, background: c.bg, color: c.text, textTransform: "uppercase",
    }}>
      {priority}
    </span>
  );
}

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || "#6b7280";
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 8,
      fontSize: 10, fontWeight: 600, background: color + "33", color,
    }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function TaskCard({ task, onStatusChange, onEdit }) {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, status: newStatus }),
      });
      if (res.ok && onStatusChange) {
        onStatusChange(task.id, newStatus);
      }
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setUpdating(false);
    }
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  return (
    <div className="task-card" style={{ opacity: updating ? 0.5 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{task.title}</div>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6, lineHeight: 1.4 }}>
          {task.description.length > 120 ? task.description.slice(0, 120) + "..." : task.description}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {task.role && <RoleBadge role={task.role} />}
          {task.due_date && (
            <span style={{
              fontSize: 10, color: isOverdue ? "#ef4444" : "#6b7280",
              fontWeight: isOverdue ? 600 : 400,
            }}>
              {isOverdue ? "OVERDUE " : ""}
              {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{
            fontSize: 10, padding: "1px 4px", borderRadius: 4,
            background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333",
            cursor: "pointer",
          }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {task.tags && task.tags.length > 0 && (
        <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
          {task.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 9, padding: "0 4px", borderRadius: 4,
              background: "#ffffff11", color: "#9ca3af",
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTaskForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", priority: "medium", role: "architect", due_date: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ title: "", description: "", priority: "medium", role: "architect", due_date: "" });
        setOpen(false);
        if (onCreated) onCreated();
      }
    } catch (err) {
      console.error("Create task failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="create-task-btn">
        + New Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="create-task-form">
      <input
        placeholder="Task title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        autoFocus
        required
        style={{ width: "100%", padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 13 }}
      />
      <textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={2}
        style={{ width: "100%", padding: "8px 10px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
          style={{ flex: 1, padding: "6px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
        </select>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
          style={{ flex: 1, padding: "6px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          style={{ flex: 1, padding: "6px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving}
          style={{ padding: "6px 16px", background: "#c4a237", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Creating..." : "Create Task"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          style={{ padding: "6px 16px", background: "transparent", color: "#9ca3af", border: "1px solid #333", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function TaskBoard({ initialTasks = [], view = "board" }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filterRole, setFilterRole] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [currentView, setCurrentView] = useState(view);

  const handleStatusChange = (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleCreated = async () => {
    // Refresh tasks from server
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  const filtered = tasks.filter(t => {
    if (filterRole && t.role !== filterRole) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <CreateTaskForm onCreated={handleCreated} />
        <div style={{ flex: 1 }} />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          style={{ padding: "5px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          <option value="">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          style={{ padding: "5px 8px", background: "#1a1a2e", color: "#e0e0e0", border: "1px solid #333", borderRadius: 6, fontSize: 12 }}>
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ display: "flex", gap: 2, background: "#1a1a2e", borderRadius: 6, padding: 2 }}>
          <button onClick={() => setCurrentView("board")}
            style={{ padding: "4px 10px", borderRadius: 4, border: "none", fontSize: 11, cursor: "pointer",
              background: currentView === "board" ? "#333" : "transparent", color: "#e0e0e0" }}>
            Board
          </button>
          <button onClick={() => setCurrentView("list")}
            style={{ padding: "4px 10px", borderRadius: 4, border: "none", fontSize: 11, cursor: "pointer",
              background: currentView === "list" ? "#333" : "transparent", color: "#e0e0e0" }}>
            List
          </button>
        </div>
      </div>

      {/* Board View */}
      {currentView === "board" && (
        <div className="task-board-columns">
          {STATUS_COLUMNS.filter(col => col.key !== "done").map(col => {
            const colTasks = filtered.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="task-board-column">
                <div className="task-column-header" style={{ borderTopColor: col.color }}>
                  <span>{col.label}</span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{colTasks.length}</span>
                </div>
                <div className="task-column-body">
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center", padding: 16 }}>
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {currentView === "list" && (
        <div className="task-list">
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "#6b7280", padding: 32 }}>No tasks match filters</div>
          )}
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}

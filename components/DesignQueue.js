"use client";

import { useState, useCallback } from "react";

const DESIGN_STATUSES = ["Not Started", "In Progress", "Complete"];

const STATUS_COLORS = {
  "Not Started": "var(--status-gray)",
  "In Progress": "var(--status-blue)",
  Complete: "var(--status-green)",
};

function DesignRow({ task, onStatusChange }) {
  const [status, setStatus] = useState(task.status || "Not Started");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setSaving(true);
    try {
      const res = await fetch("/api/designs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: task.id, status: newStatus }),
      });
      const data = await res.json();
      setLastSaved(data.success ? "saved" : data.mock ? "offline" : "error");
      if (onStatusChange) onStatusChange(task.id, newStatus);
    } catch {
      setLastSaved("error");
    } finally {
      setSaving(false);
      setTimeout(() => setLastSaved(null), 2000);
    }
  };

  const isComplete = status === "Complete";

  return (
    <tr
      style={{
        opacity: isComplete ? 0.5 : 1,
        background: saving
          ? "rgba(212, 175, 55, 0.04)"
          : lastSaved === "saved"
          ? "rgba(34, 197, 94, 0.04)"
          : "transparent",
        transition: "background 0.3s ease",
      }}
    >
      <td>
        <span style={{ fontWeight: 500, color: "var(--text-bright)" }}>
          {task.heroName || "—"}
        </span>
      </td>
      <td>{task.rank || "—"}</td>
      <td>{task.branch || "—"}</td>
      <td>{task.classYear || "—"}</td>
      <td>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {task.customText || "—"}
        </span>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select
            value={status}
            onChange={handleStatusChange}
            style={{
              background: "var(--bg)",
              color: STATUS_COLORS[status] || "var(--text-bright)",
              border: `1px solid ${STATUS_COLORS[status] || "var(--card-border)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "3px 6px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {DESIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {saving && <span style={{ fontSize: 10, color: "var(--gold)" }}>saving...</span>}
          {lastSaved === "saved" && <span style={{ fontSize: 10, color: "var(--status-green)" }}>✓</span>}
          {lastSaved === "error" && <span style={{ fontSize: 10, color: "var(--status-red)" }}>failed</span>}
        </div>
      </td>
      <td>{task.assignee || "Unassigned"}</td>
      <td>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {task.notes || "—"}
        </span>
      </td>
    </tr>
  );
}

export default function DesignQueue({ tasks }) {
  const [taskData, setTaskData] = useState(tasks);

  const handleStatusChange = useCallback((id, newStatus) => {
    setTaskData((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
  }, []);

  if (taskData.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
        No design tasks in queue. Designs are added when an order needs a new bracelet design.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Hero</th>
            <th>Rank</th>
            <th>Branch</th>
            <th>Class</th>
            <th>Custom Text</th>
            <th>Status</th>
            <th>Assignee</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {taskData.map((task) => (
            <DesignRow
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

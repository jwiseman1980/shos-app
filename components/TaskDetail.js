"use client";

import { useState, useCallback } from "react";

/**
 * Task Detail — expanded view for a task in the main panel.
 *
 * Shows task info, subtasks (if any), and action buttons.
 * Start/Complete trigger execution logging + Slack announce.
 */
export default function TaskDetail({ task, onComplete, onStart }) {
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          domain: task.domain || "general",
          title: `Started: ${task.title}`,
          outcome: "in_progress",
          startedAt: new Date().toISOString(),
        }),
      });
      onStart?.(task.id);
    } catch (err) {
      console.error("Start task failed:", err);
    } finally {
      setStarting(false);
    }
  }, [task, onStart]);

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    try {
      const now = new Date().toISOString();

      // Log execution to calendar + Supabase
      await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          domain: task.domain || "general",
          title: `Completed: ${task.title}`,
          outcome: "completed",
          startedAt: task.startedAt || now,
          completedAt: now,
          durationMinutes: task.startedAt
            ? Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000)
            : task.estimatedMinutes || 0,
        }),
      });

      // If it's a Supabase task, update status
      if (task.sourceType === "task" && !task.id.startsWith("calendar-") && !task.id.startsWith("sop-")) {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: task.id,
            status: "done",
            completed_at: now,
          }),
        });
      }

      // Announce in Slack
      await fetch("/api/slack/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `\u2705 Completed: ${task.title}`,
          channel: "ops",
        }),
      }).catch(() => {}); // Non-blocking

      onComplete?.(task.id);
    } catch (err) {
      console.error("Complete task failed:", err);
    } finally {
      setCompleting(false);
    }
  }, [task, onComplete]);

  const isActive = task.status === "active";
  const isDone = task.status === "done";

  return (
    <div className="task-detail">
      {/* Header */}
      <div className="task-detail-header">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", margin: 0 }}>
            {task.title}
          </h2>
          {task.description && (
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "6px 0 0", lineHeight: 1.5 }}>
              {task.description}
            </p>
          )}
        </div>
        <div className="task-detail-actions">
          {!isActive && !isDone && (
            <button
              onClick={handleStart}
              disabled={starting}
              className="task-detail-btn start"
            >
              {starting ? "Starting..." : "Start"}
            </button>
          )}
          {isActive && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="task-detail-btn complete"
            >
              {completing ? "Completing..." : "Mark Done"}
            </button>
          )}
          {isDone && (
            <span style={{ fontSize: 13, color: "#27ae60", fontWeight: 600 }}>
              Completed
            </span>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="task-detail-meta">
        {task.domain && (
          <span className="task-detail-tag">{task.domain}</span>
        )}
        {task.source && (
          <span className="task-detail-tag">{task.source}</span>
        )}
        {task.estimatedMinutes && (
          <span className="task-detail-tag">{task.estimatedMinutes}m est.</span>
        )}
        {task.assignee && (
          <span className="task-detail-tag">{task.assignee}</span>
        )}
        {task.time && (
          <span className="task-detail-tag">{task.time}</span>
        )}
      </div>

      {/* Deep link */}
      {task.deepLink && task.deepLink !== "/" && (
        <div style={{ marginTop: 16 }}>
          <a
            href={task.deepLink}
            style={{ fontSize: 12, color: "#3498db", textDecoration: "none" }}
          >
            Open in app &rarr;
          </a>
        </div>
      )}

      {/* Timing info for active tasks */}
      {isActive && task.startedAt && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-dim)" }}>
          Started at {new Date(task.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

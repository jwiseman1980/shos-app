"use client";

import { useState, useCallback, useEffect } from "react";
import TaskDetail from "@/components/TaskDetail";

/**
 * Main Panel — the large content area in the console.
 *
 * Switches between:
 * - "email-triage": Email inbox triage view
 * - "task-detail": Expanded task with subtasks
 * - "welcome": Default view (stats or prompt)
 */
export default function MainPanel({
  view,
  activeTask,
  emails: initialEmails,
  currentUser,
  onTaskComplete,
  onTaskStart,
  onEmailTriaged,
  onEmailToTask,
  onViewChange,
}) {
  if (view === "email-triage") {
    return (
      <EmailTriagePanel
        initialEmails={initialEmails}
        onEmailTriaged={onEmailTriaged}
        onEmailToTask={onEmailToTask}
        currentUser={currentUser}
      />
    );
  }

  if (view === "task-detail" && activeTask) {
    return (
      <TaskDetail
        task={activeTask}
        onComplete={onTaskComplete}
        onStart={onTaskStart}
      />
    );
  }

  // Welcome / default view
  return (
    <div style={{ padding: 24, color: "var(--text-dim)" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", margin: "0 0 8px" }}>
        Console
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.5 }}>
        Select a task from the sidebar to get started, or use the Operator below.
      </p>
    </div>
  );
}

/* ─── Email Triage Panel ─── */

function relativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ""; }
}

function parseFromName(from) {
  if (!from) return "";
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}

function EmailTriagePanel({ initialEmails, onEmailTriaged, onEmailToTask, currentUser }) {
  const [emails, setEmails] = useState(initialEmails || []);
  const [openEmail, setOpenEmail] = useState(null);

  // Sync when parent refreshes email list (e.g. after Operator archives via tool)
  useEffect(() => {
    if (initialEmails) setEmails(initialEmails);
  }, [initialEmails]);
  const [loadingId, setLoadingId] = useState(null);
  const [archiving, setArchiving] = useState(new Set());

  const handleArchive = useCallback(async (messageId) => {
    setArchiving((prev) => new Set([...prev, messageId]));
    try {
      await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", messageId }),
      });
      setEmails((prev) => prev.filter((e) => e.id !== messageId));
      if (openEmail?.id === messageId) setOpenEmail(null);
      onEmailTriaged?.(messageId);
    } catch (err) {
      console.error("Archive failed:", err);
    } finally {
      setArchiving((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [openEmail, onEmailTriaged]);

  const handleMarkRead = useCallback(async (messageId) => {
    try {
      await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", messageId }),
      });
      setEmails((prev) =>
        prev.map((e) => (e.id === messageId ? { ...e, isUnread: false } : e))
      );
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  }, []);

  const handleOpen = useCallback(async (messageId) => {
    setLoadingId(messageId);
    try {
      const res = await fetch(`/api/email/${messageId}`);
      if (res.ok) {
        const data = await res.json();
        setOpenEmail(data);
        handleMarkRead(messageId);
      }
    } catch (err) {
      console.error("Failed to load email:", err);
    } finally {
      setLoadingId(null);
    }
  }, [handleMarkRead]);

  const handleConvertToTask = useCallback(async (email) => {
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_to_task",
          messageId: email.id,
          subject: email.subject,
          from: email.from,
          snippet: email.snippet,
        }),
      });
      if (res.ok) {
        const { task } = await res.json();
        onEmailToTask?.(task);
        // Archive after converting
        handleArchive(email.id);
      }
    } catch (err) {
      console.error("Convert to task failed:", err);
    }
  }, [handleArchive, onEmailToTask]);

  // Detail view
  if (openEmail) {
    return (
      <div className="email-triage-detail">
        <div className="email-triage-detail-header">
          <button
            onClick={() => setOpenEmail(null)}
            className="email-triage-back"
          >
            &larr; Back to inbox
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleConvertToTask(openEmail)}
              className="email-triage-action-btn convert"
            >
              + Task
            </button>
            <button
              onClick={() => handleArchive(openEmail.id)}
              className="email-triage-action-btn handled"
            >
              Handled
            </button>
          </div>
        </div>
        <div className="email-triage-detail-content">
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-bright)", margin: "0 0 8px" }}>
            {openEmail.subject}
          </h3>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
            From: {openEmail.from} &middot; {openEmail.date}
          </div>
          <div
            style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
          >
            {openEmail.body || openEmail.snippet}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="email-triage-panel">
      <div className="email-triage-header">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-bright)", margin: 0 }}>
          Email Triage
        </h3>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {emails.length} unread
        </span>
      </div>
      <div className="email-triage-list">
        {emails.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            Inbox clear. Nice work.
          </div>
        )}
        {emails.map((email) => (
          <div
            key={email.id}
            className={`email-triage-row ${loadingId === email.id ? "loading" : ""}`}
          >
            <div className="email-triage-row-content" onClick={() => handleOpen(email.id)} style={{ cursor: "pointer" }}>
              <div className="email-triage-row-meta">
                <span className="email-triage-from">
                  {parseFromName(email.fromName || email.from)}
                </span>
                <span className="email-triage-time">{relativeTime(email.date)}</span>
              </div>
              <div className="email-triage-subject">{email.subject}</div>
            </div>
            <div className="email-triage-row-actions" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleConvertToTask(email)}
                className="email-triage-mini-btn"
                title="Convert to task"
              >
                →Task
              </button>
              <a
                href={`https://mail.google.com/mail/u/0/#inbox/${email.threadId || email.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="email-triage-mini-btn"
                title="Open in Gmail"
                onClick={(e) => e.stopPropagation()}
              >
                ↗
              </a>
              <button
                onClick={() => handleArchive(email.id)}
                className="email-triage-mini-btn"
                title="Archive"
                disabled={archiving.has(email.id)}
              >
                {archiving.has(email.id) ? "…" : "✓"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import TaskDetail from "@/components/TaskDetail";
import EmailInbox from "@/components/EmailInbox";

/**
 * Main Panel — the large content area in the console.
 *
 * Switches between:
 * - "dashboard": KPI overview + task summary (default)
 * - "email-triage": Email inbox triage view
 * - "task-detail": Expanded task detail with checklist
 */
export default function MainPanel({
  view,
  activeTask,
  tasks = [],
  emails: initialEmails,
  emailCount = 0,
  currentUser,
  onTaskComplete,
  onTaskStart,
  onTaskClick,
  onEmailTriaged,
  onEmailToTask,
  onViewChange,
  greeting,
}) {
  if (view === "email-triage") {
    return (
      <div style={{ padding: 16, height: "100%", overflowY: "auto" }}>
        <EmailInbox
          initialMessages={initialEmails}
          onEmailToTask={onEmailToTask}
        />
      </div>
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

  // Dashboard (default)
  return (
    <DashboardView
      tasks={tasks}
      emailCount={emailCount}
      onTaskClick={onTaskClick}
      onViewChange={onViewChange}
      greeting={greeting}
    />
  );
}

/* ─── Dashboard ─── */

const DOMAIN_COLORS = {
  general: "var(--text-dim)",
  comms: "var(--status-blue)",
  family: "#8e44ad",
  finance: "var(--status-green)",
  development: "var(--gold)",
  ops: "var(--status-orange)",
  social: "#e84393",
};

function StatPill({ label, value, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: 8,
        padding: "14px 16px",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = accent; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.borderColor = "var(--card-border)"; }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </button>
  );
}

function TaskRow({ task, onClick }) {
  const domainColor = DOMAIN_COLORS[task.domain] || "var(--text-dim)";
  const isOverdue = task.date && task.date < new Date().toISOString().split("T")[0] && task.status !== "done";
  return (
    <button
      onClick={() => onClick?.(task)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        width: "100%", textAlign: "left", background: "none",
        border: "none", borderBottom: "1px solid var(--card-border)",
        padding: "9px 0", cursor: "pointer",
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = "0.75"}
      onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
    >
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: isOverdue ? "var(--status-red)" : domainColor,
        flexShrink: 0, marginTop: 5,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, display: "flex", gap: 8 }}>
          {task.domain && <span>{task.domain}</span>}
          {task.estimatedMinutes && <span>{task.estimatedMinutes}m</span>}
          {isOverdue && <span style={{ color: "var(--status-red)", fontWeight: 600 }}>overdue</span>}
        </div>
      </div>
      {task.priority === "critical" && (
        <span style={{ fontSize: 10, color: "var(--status-red)", fontWeight: 700, flexShrink: 0, marginTop: 2 }}>!</span>
      )}
    </button>
  );
}

function DashboardSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function DashboardView({ tasks, emailCount, onTaskClick, onViewChange, greeting }) {
  const today = new Date().toISOString().split("T")[0];

  const todayTasks = tasks.filter(
    (t) => t.status !== "done" && (t.date === today || !t.date)
  );
  const overdue = tasks.filter(
    (t) => t.status !== "done" && t.date && t.date < today
  );
  const critical = tasks.filter(
    (t) => t.status !== "done" && t.priority === "critical"
  );
  const upcoming = tasks.filter(
    (t) => t.status !== "done" && t.date && t.date > today
  ).slice(0, 5);

  // Domain breakdown of today's tasks
  const domainCounts = {};
  for (const t of todayTasks) {
    const d = t.domain || "general";
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const priorityTasks = [
    ...tasks.filter((t) => t.status !== "done" && t.priority === "critical"),
    ...tasks.filter((t) => t.status !== "done" && t.priority === "high" && (t.date === today || !t.date)),
    ...todayTasks.filter((t) => t.priority !== "critical" && t.priority !== "high"),
  ].filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i).slice(0, 8);

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      {/* Greeting */}
      {greeting && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-bright)" }}>{greeting}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
        </div>
      )}

      {/* KPI pills */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <StatPill
          label="Due today"
          value={todayTasks.length}
          accent="var(--status-blue)"
          onClick={todayTasks.length > 0 ? () => onTaskClick?.(todayTasks[0]) : null}
        />
        <StatPill
          label="Overdue"
          value={overdue.length}
          accent={overdue.length > 0 ? "var(--status-red)" : "var(--text-dim)"}
          onClick={overdue.length > 0 ? () => onTaskClick?.(overdue[0]) : null}
        />
        <StatPill
          label="Emails"
          value={emailCount}
          accent={emailCount > 0 ? "var(--gold)" : "var(--text-dim)"}
          onClick={emailCount > 0 ? () => onViewChange?.("email-triage") : null}
        />
        <StatPill
          label="Upcoming"
          value={tasks.filter((t) => t.date && t.date > today && t.status !== "done").length}
          accent="var(--text-dim)"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left column */}
        <div>
          <DashboardSection title="Priority queue">
            {priorityTasks.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-dim)", padding: "8px 0" }}>All clear.</div>
            ) : (
              priorityTasks.map((t) => (
                <TaskRow key={t.id} task={t} onClick={onTaskClick} />
              ))
            )}
          </DashboardSection>
        </div>

        {/* Right column */}
        <div>
          {overdue.length > 0 && (
            <DashboardSection title={`Overdue (${overdue.length})`}>
              {overdue.slice(0, 5).map((t) => (
                <TaskRow key={t.id} task={t} onClick={onTaskClick} />
              ))}
            </DashboardSection>
          )}

          {upcoming.length > 0 && (
            <DashboardSection title="Coming up">
              {upcoming.map((t) => (
                <div key={t.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--card-border)" }}>
                  <div style={{ fontSize: 13, color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                    {new Date(t.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                </div>
              ))}
            </DashboardSection>
          )}

          {topDomains.length > 1 && (
            <DashboardSection title="Today by domain">
              {topDomains.map(([domain, count]) => (
                <div key={domain} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 0", borderBottom: "1px solid var(--card-border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: DOMAIN_COLORS[domain] || "var(--text-dim)" }} />
                    <span style={{ fontSize: 12, color: "var(--text-bright)", textTransform: "capitalize" }}>{domain}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{count}</span>
                </div>
              ))}
            </DashboardSection>
          )}
        </div>
      </div>
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
  const [draft, setDraft] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

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

  const handleDraftReply = useCallback(async () => {
    setDraftLoading(true);
    setDraft("");
    setDraftSaved(false);
    try {
      const res = await fetch("/api/email/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: openEmail.id,
          subject: openEmail.subject,
          from: openEmail.from,
          body: openEmail.body,
          snippet: openEmail.snippet,
        }),
      });
      const data = await res.json();
      setDraft(data.draft || "");
    } catch {
      setDraft("Failed to generate draft. Try again.");
    } finally {
      setDraftLoading(false);
    }
  }, [openEmail]);

  const handleSaveDraft = useCallback(async () => {
    try {
      await fetch("/api/email/draft-reply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: openEmail.from,
          subject: openEmail.subject,
          body: draft,
          threadId: openEmail.threadId,
          messageId: openEmail.id,
        }),
      });
      setDraftSaved(true);
    } catch {
      alert("Failed to save draft");
    }
  }, [openEmail, draft]);

  // Detail view
  if (openEmail) {
    return (
      <div className="email-triage-detail">
        <div className="email-triage-detail-header">
          <button onClick={() => { setOpenEmail(null); setDraft(""); setDraftSaved(false); }} className="email-triage-back">
            &larr; Back to inbox
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleDraftReply} className="email-triage-action-btn" disabled={draftLoading}>
              {draftLoading ? "Drafting…" : "Draft Reply"}
            </button>
            <button onClick={() => handleConvertToTask(openEmail)} className="email-triage-action-btn convert">
              + Task
            </button>
            <button onClick={() => handleArchive(openEmail.id)} className="email-triage-action-btn handled">
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
          <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {openEmail.body || openEmail.snippet}
          </div>

          {(draft || draftLoading) && (
            <div className="email-draft-panel">
              <div className="email-draft-label">Draft Reply</div>
              {draftLoading ? (
                <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "12px 0" }}>Generating…</div>
              ) : (
                <>
                  <textarea
                    className="email-draft-textarea"
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); setDraftSaved(false); }}
                    rows={10}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={handleSaveDraft} className="email-triage-action-btn" disabled={draftSaved}>
                      {draftSaved ? "Saved to Gmail Drafts ✓" : "Save to Gmail Drafts"}
                    </button>
                    <button onClick={() => { setDraft(""); setDraftSaved(false); }} className="email-triage-action-btn">
                      Discard
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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

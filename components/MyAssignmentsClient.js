"use client";

import { useState, useCallback } from "react";
import DataCard from "@/components/DataCard";

const PRIORITY_COLOR = {
  critical: "var(--status-red)",
  high:     "var(--status-orange)",
  medium:   "var(--gold)",
  low:      "var(--text-dim)",
};

function priorityDot(priority) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: PRIORITY_COLOR[priority] || "var(--text-dim)",
        marginRight: 8,
        flexShrink: 0,
      }}
    />
  );
}

function fmtDay(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

function TaskRow({ task, onDone }) {
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const markDone = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        setHidden(true);
        onDone?.(task.id);
      }
    } finally {
      setBusy(false);
    }
  }, [task.id, onDone]);

  if (hidden) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius-md)",
        marginBottom: 6,
      }}
    >
      {priorityDot(task.priority)}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>
          {task.title}
        </div>
        {task.description && (
          <div style={{
            fontSize: 11,
            color: "var(--text-dim)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {task.description}
          </div>
        )}
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, display: "flex", gap: 8 }}>
          {task.due_date && <span>Due {fmtDay(task.due_date)}</span>}
          {task.role && <span>· {task.role}</span>}
          {task.status && <span>· {task.status}</span>}
        </div>
      </div>
      <button
        onClick={markDone}
        disabled={busy}
        className="btn btn-primary"
        style={{ padding: "4px 10px", fontSize: 11 }}
      >
        {busy ? "…" : "Mark done"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anniversary row (assigned to me)
// ---------------------------------------------------------------------------

function AnniversaryRow({ hero, onStatusChange, onUnclaim }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(hero.status);
  const [draftResult, setDraftResult] = useState(null);

  const updateStatus = useCallback(async (next) => {
    setBusy(true);
    try {
      const res = await fetch("/api/anniversaries/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sfId: hero.sfId || hero.id, status: next }),
      });
      if (res.ok) {
        setStatus(next);
        onStatusChange?.(hero.id, next);
      }
    } finally {
      setBusy(false);
    }
  }, [hero.sfId, hero.id, onStatusChange]);

  const draftEmail = useCallback(async () => {
    setBusy(true);
    setDraftResult(null);
    try {
      const res = await fetch("/api/anniversaries/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName: hero.fullName,
          branch: hero.branch,
          years: hero.years,
          memorialDate: hero.memorialDate,
          familyEmail: hero.familyContactEmail,
          familyName: hero.familyContactName,
          senderEmail: hero.senderEmail,
          senderName: hero.senderName,
          sfId: hero.sfId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDraftResult("drafted");
        setStatus("email_drafted");
      } else {
        setDraftResult("error");
      }
    } catch {
      setDraftResult("error");
    } finally {
      setBusy(false);
      setTimeout(() => setDraftResult(null), 4000);
    }
  }, [hero]);

  const unclaim = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/heroes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sfId: hero.sfId || hero.id, assignedToName: null, heroName: hero.fullName }),
      });
      if (res.ok) onUnclaim?.(hero.id);
    } finally {
      setBusy(false);
    }
  }, [hero.sfId, hero.id, hero.fullName, onUnclaim]);

  const isDrafted = status === "email_drafted" || status === "in_progress";
  const isSent = ["sent", "email_sent", "scheduled", "complete", "completed"].includes(status);

  return (
    <div
      style={{
        padding: 12,
        background: isSent ? "rgba(34,197,94,0.04)" : "var(--bg)",
        border: "1px solid var(--card-border)",
        borderLeft: `3px solid ${isSent ? "var(--status-green)" : isDrafted ? "var(--gold)" : "var(--status-orange)"}`,
        borderRadius: "var(--radius-md)",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>
            {hero.fullName}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
            {hero.branch} · {fmtDay(hero.memorialDate)}{hero.years != null ? ` (${hero.years} yrs)` : ""}
            {hero.familyContactName && ` · Family: ${hero.familyContactName}`}
            {hero.needsResearch && (
              <span style={{ color: "var(--status-orange)", fontWeight: 600 }}>
                {" "}· No family contact on file
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            background: isSent ? "rgba(34,197,94,0.15)" : isDrafted ? "rgba(196,162,55,0.15)" : "rgba(245,158,11,0.15)",
            color: isSent ? "var(--status-green)" : isDrafted ? "var(--gold)" : "var(--status-orange)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          {isSent ? "Sent" : isDrafted ? "Drafted" : "Not started"}
        </span>
      </div>

      {!isSent && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {!hero.needsResearch && !isDrafted && (
            <button
              onClick={draftEmail}
              disabled={busy}
              className="btn btn-primary"
              style={{ padding: "4px 10px", fontSize: 11 }}
            >
              {busy ? "…" : draftResult === "drafted" ? "✓ Drafted" : "Draft email"}
            </button>
          )}
          {isDrafted && (
            <a
              href="https://mail.google.com/mail/u/0/#drafts"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ padding: "4px 10px", fontSize: 11 }}
            >
              Open Gmail drafts ↗
            </a>
          )}
          <button
            onClick={() => updateStatus("scheduled")}
            disabled={busy}
            className="btn btn-ghost"
            style={{ padding: "4px 10px", fontSize: 11 }}
          >
            Mark scheduled
          </button>
          <button
            onClick={() => updateStatus("sent")}
            disabled={busy}
            className="btn btn-ghost"
            style={{ padding: "4px 10px", fontSize: 11, color: "var(--status-green)" }}
          >
            Mark sent
          </button>
          <button
            onClick={unclaim}
            disabled={busy}
            className="btn btn-ghost"
            style={{ padding: "4px 10px", fontSize: 11, color: "var(--text-dim)" }}
            title="Release this assignment back to the unassigned queue"
          >
            Unclaim
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Available-to-claim row
// ---------------------------------------------------------------------------

function ClaimRow({ hero, currentUser, onClaimed }) {
  const [busy, setBusy] = useState(false);

  const claim = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/heroes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sfId: hero.sfId || hero.id,
          assignedToName: currentUser.name,
          heroName: hero.fullName,
        }),
      });
      if (res.ok) onClaimed?.(hero.id, hero);
    } finally {
      setBusy(false);
    }
  }, [hero, currentUser.name, onClaimed]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius-md)",
        marginBottom: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-bright)" }}>
          {hero.fullName}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
          {hero.branch} · {fmtDay(hero.memorialDate)}{hero.years != null ? ` (${hero.years} yrs)` : ""}
          {hero.needsResearch && (
            <span style={{ color: "var(--status-orange)", fontWeight: 600 }}>
              {" "}· Needs family research
            </span>
          )}
        </div>
      </div>
      <button
        onClick={claim}
        disabled={busy}
        className="btn btn-primary"
        style={{ padding: "4px 12px", fontSize: 11 }}
      >
        {busy ? "…" : "Claim"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function MyAssignmentsClient({
  tasks,
  annOpen,
  annDone,
  availableToClaim,
  currentUser,
  isAnniversaryTeam,
  monthName,
}) {
  const [openAnns, setOpenAnns] = useState(annOpen);
  const [doneAnns, setDoneAnns] = useState(annDone);
  const [available, setAvailable] = useState(availableToClaim);

  const handleClaimed = useCallback((heroId, hero) => {
    setAvailable((prev) => prev.filter((h) => h.id !== heroId));
    setOpenAnns((prev) => [...prev, hero]);
  }, []);

  const handleUnclaim = useCallback((heroId) => {
    const hero = openAnns.find((h) => h.id === heroId);
    setOpenAnns((prev) => prev.filter((h) => h.id !== heroId));
    if (hero) setAvailable((prev) => [...prev, hero].sort((a, b) => (a.dayOfMonth || 0) - (b.dayOfMonth || 0)));
  }, [openAnns]);

  const handleStatusChange = useCallback((heroId, newStatus) => {
    const done = ["sent", "email_sent", "scheduled", "complete", "completed"];
    if (done.includes(newStatus)) {
      const hero = openAnns.find((h) => h.id === heroId);
      setOpenAnns((prev) => prev.filter((h) => h.id !== heroId));
      if (hero) setDoneAnns((prev) => [...prev, { ...hero, status: newStatus }]);
    } else {
      setOpenAnns((prev) => prev.map((h) => h.id === heroId ? { ...h, status: newStatus } : h));
    }
  }, [openAnns]);

  return (
    <>
      {openAnns.length > 0 && (
        <DataCard title={`Anniversary emails — ${openAnns.length} open`}>
          {openAnns
            .sort((a, b) => {
              const ad = new Date(a.memorialDate || 0).getTime();
              const bd = new Date(b.memorialDate || 0).getTime();
              return ad - bd;
            })
            .map((hero) => (
              <AnniversaryRow
                key={hero.id}
                hero={{ ...hero, senderEmail: currentUser.email, senderName: currentUser.name }}
                onStatusChange={handleStatusChange}
                onUnclaim={handleUnclaim}
              />
            ))}
        </DataCard>
      )}

      {tasks.length > 0 && (
        <DataCard title={`Tasks — ${tasks.length}`}>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </DataCard>
      )}

      {isAnniversaryTeam && available.length > 0 && (
        <DataCard title={`${monthName} anniversaries available to claim — ${available.length}`}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>
            Pick the ones you'll write. Each claim notifies you on Slack with a draft button.
          </div>
          {available.map((hero) => (
            <ClaimRow
              key={hero.id}
              hero={hero}
              currentUser={currentUser}
              onClaimed={handleClaimed}
            />
          ))}
        </DataCard>
      )}

      {doneAnns.length > 0 && (
        <DataCard title={`Sent / scheduled — ${doneAnns.length}`}>
          {doneAnns.map((hero) => (
            <div
              key={hero.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                fontSize: 12,
                color: "var(--text-dim)",
              }}
            >
              <span style={{ color: "var(--status-green)" }}>✓</span>
              <span style={{ flex: 1 }}>{hero.fullName}</span>
              <span style={{ fontSize: 10 }}>{fmtDay(hero.memorialDate)}</span>
            </div>
          ))}
        </DataCard>
      )}

      {tasks.length === 0 && openAnns.length === 0 && available.length === 0 && (
        <DataCard>
          <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            Nothing assigned right now. You'll get a Slack DM when something comes in.
          </p>
        </DataCard>
      )}
    </>
  );
}

"use client";

import { useState, useCallback } from "react";
import { isFamilyRelationship } from "@/lib/relationships";

/**
 * AnniversaryDetail — expanded view for anniversary email tasks.
 *
 * Shows hero info, family contact, and lets the user draft a
 * remembrance email to Gmail. Human reviews and sends from Gmail.
 */
export default function AnniversaryDetail({ task, onComplete, onBack }) {
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState(null); // { draftId, message }
  const [draftError, setDraftError] = useState(null);
  const [markingSent, setMarkingSent] = useState(false);
  const [notes, setNotes] = useState(task.anniversaryNotes || "");
  const [notesSaved, setNotesSaved] = useState(true);
  const [notesTimer, setNotesTimer] = useState(null);

  const status = (task.anniversaryStatus || "not_started").toLowerCase().replace(/\s+/g, "_");
  const needsResearch = !task.familyContactEmail;
  const wrongContact = !!task.familyContactEmail && !isFamilyRelationship(task.familyContactRelationship);
  const isDrafted = status === "email_drafted" || status === "in_progress" || !!draftResult;
  const isSent = status === "email_sent" || status === "sent" || status === "complete" || status === "completed";

  const handleDraftEmail = useCallback(async () => {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/anniversaries/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName: task.heroName,
          branch: task.heroBranch,
          years: task.heroYears,
          memorialDate: task.heroMemorialDate,
          familyEmail: task.familyContactEmail,
          familyName: task.familyContactName,
          senderEmail: task.senderEmail || "joseph.wiseman@steel-hearts.org",
          senderName: task.assignedTo || "Joseph Wiseman",
          sfId: task.heroSfId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDraftResult(data);
      } else {
        setDraftError(data.error || "Failed to create draft");
      }
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setDrafting(false);
    }
  }, [task]);

  const handleMarkSent = useCallback(async () => {
    setMarkingSent(true);
    try {
      await fetch("/api/anniversaries/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sfId: task.heroSfId,
          status: "sent",
        }),
      });
      onComplete?.(task.id);
    } catch (err) {
      console.error("Mark sent failed:", err);
    } finally {
      setMarkingSent(false);
    }
  }, [task, onComplete]);

  const handleNotesChange = useCallback((value) => {
    setNotes(value);
    setNotesSaved(false);
    if (notesTimer) clearTimeout(notesTimer);
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/anniversaries/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sfId: task.heroSfId,
            notes: value,
          }),
        });
        setNotesSaved(true);
      } catch {}
    }, 1500);
    setNotesTimer(timer);
  }, [task.heroSfId, notesTimer]);

  const statusLabel = isSent ? "Sent" : isDrafted ? "Draft Created" : "Not Started";
  const statusColor = isSent ? "#27ae60" : isDrafted ? "#c4a237" : "var(--text-dim)";

  const memorialDateFormatted = task.heroMemorialDate
    ? new Date(task.heroMemorialDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  return (
    <div className="task-detail">
      {/* Header */}
      <div className="task-detail-header">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-bright)", margin: 0 }}>
            {task.heroName || task.title}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "6px 0 0", lineHeight: 1.5 }}>
            {task.heroBranch} &middot; Memorial: {memorialDateFormatted}
            {task.heroYears != null && ` (${task.heroYears} years)`}
          </p>
        </div>
        <div className="task-detail-actions">
          <button
            onClick={onBack}
            className="task-detail-btn"
            style={{ background: "none", border: "1px solid var(--card-border)", color: "var(--text-dim)" }}
          >
            &larr; Back
          </button>
        </div>
      </div>

      {/* Status + meta tags */}
      <div className="task-detail-meta">
        <span className="task-detail-tag" style={{ color: statusColor, borderColor: statusColor }}>
          {statusLabel}
        </span>
        <span className="task-detail-tag">family</span>
        {task.assignedTo && (
          <span className="task-detail-tag">{task.assignedTo}</span>
        )}
        {task.heroSku && (
          <span className="task-detail-tag">{task.heroSku}</span>
        )}
      </div>

      {/* Family contact */}
      <div style={{ margin: "20px 0", padding: 16, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Family Contact
        </div>
        {needsResearch ? (
          <div style={{ fontSize: 13, color: "var(--status-red)" }}>
            No family contact on file — research needed before outreach
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-bright)" }}>
            <div>{task.familyContactName || "Name not on file"}</div>
            <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
              {task.familyContactEmail}
            </div>
            {Array.isArray(task.familyContactRelationship) && task.familyContactRelationship.length > 0 && (
              <div style={{ color: wrongContact ? "var(--status-orange)" : "var(--text-dim)", marginTop: 4, fontStyle: "italic", fontSize: 12 }}>
                {task.familyContactRelationship.join(", ")}
              </div>
            )}
            {wrongContact && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--status-orange)" }}>
                Linked contact is not Surviving/Extended Family. Repoint <code>family_contact_id</code> at a family member before drafting.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {!needsResearch && !wrongContact && !isSent && (
          <button
            onClick={handleDraftEmail}
            disabled={drafting}
            className="task-detail-btn start"
          >
            {drafting ? "Creating Draft..." : isDrafted ? "Re-Draft Email" : "Draft Email"}
          </button>
        )}
        {(isDrafted || draftResult) && !isSent && (
          <button
            onClick={handleMarkSent}
            disabled={markingSent}
            className="task-detail-btn complete"
          >
            {markingSent ? "Updating..." : "Mark Sent"}
          </button>
        )}
        <a
          href="https://mail.google.com/mail/u/0/#drafts"
          target="_blank"
          rel="noopener noreferrer"
          className="task-detail-btn"
          style={{
            background: "none",
            border: "1px solid var(--card-border)",
            color: "#3498db",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Open Gmail Drafts &nearr;
        </a>
      </div>

      {/* Draft result */}
      {draftResult && (
        <div style={{
          margin: "16px 0",
          padding: 16,
          background: "rgba(39, 174, 96, 0.08)",
          border: "1px solid rgba(39, 174, 96, 0.25)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--text-bright)",
        }}>
          Draft created in Gmail. Open your drafts to review, edit, and schedule-send for the anniversary date.
        </div>
      )}

      {/* Draft error */}
      {draftError && (
        <div style={{
          margin: "16px 0",
          padding: 16,
          background: "rgba(231, 76, 60, 0.08)",
          border: "1px solid rgba(231, 76, 60, 0.25)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--status-red)",
        }}>
          {draftError}
        </div>
      )}

      {/* Notes */}
      <div style={{ marginTop: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "var(--text-dim)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>Notes</span>
          {!notesSaved && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>saving...</span>}
        </div>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this anniversary outreach..."
          style={{
            width: "100%",
            minHeight: 80,
            padding: 10,
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: 6,
            color: "var(--text-bright)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      </div>

      {/* Deep link to full anniversary page */}
      <div style={{ marginTop: 16 }}>
        <a
          href="/anniversaries"
          style={{ fontSize: 12, color: "#3498db", textDecoration: "none" }}
        >
          View all anniversaries &rarr;
        </a>
      </div>
    </div>
  );
}

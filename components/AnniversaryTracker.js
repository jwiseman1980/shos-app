"use client";

import { useState, useCallback, useEffect } from "react";
import StatusBadge from "@/components/StatusBadge";

const STATUS_OPTIONS = ["Not Sent", "Scheduled", "Sent"];

function normalizeStatus(status) {
  if (!status) return "not_sent";
  const s = status.toLowerCase().replace(/\s+/g, "_");
  if (["sent", "email_sent", "complete", "completed", "social_posted"].includes(s)) return "sent";
  if (["scheduled"].includes(s)) return "scheduled";
  return "not_sent";
}

function statusLabel(status) {
  const n = normalizeStatus(status);
  if (n === "sent") return "Sent";
  if (n === "scheduled") return "Scheduled";
  return "Not Sent";
}

function HeroRow({ hero, day, years, isPast, isToday, monthName, volunteers, onUpdate, currentUser }) {
  const [status, setStatus] = useState(hero.anniversaryStatus || "Not Started");
  const [assignedTo, setAssignedTo] = useState(hero.anniversaryAssignedTo || "");
  const [notes, setNotes] = useState(hero.anniversaryNotes || "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [draftResult, setDraftResult] = useState(null);
  const save = useCallback(async (fields) => {
    setSaving(true);
    setLastSaved(null);
    try {
      const res = await fetch("/api/heroes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sfId: hero.sfId, ...fields }),
      });
      const data = await res.json();
      if (data.success) {
        setLastSaved("saved");
        if (onUpdate) onUpdate(hero.sfId, fields);
      } else {
        setLastSaved(data.mock ? "offline" : "error");
      }
    } catch {
      setLastSaved("error");
    } finally {
      setSaving(false);
      setTimeout(() => setLastSaved(null), 2000);
    }
  }, [hero.sfId, onUpdate]);

  const handleAssignChange = (e) => {
    const newAssign = e.target.value;
    setAssignedTo(newAssign);
    save({ assignedToName: newAssign || null });
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    save({ status: newStatus });
  };

  const handleNotesSave = () => {
    setEditingNotes(false);
    save({ notes });
  };

  const handleDraftEmail = useCallback(async () => {
    setDraftingEmail(true);
    setDraftResult(null);
    try {
      const res = await fetch("/api/anniversaries/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName: hero.fullName || hero.name || "",
          branch: hero.serviceCode || hero.branch || "",
          years: years || 0,
          memorialDate: hero.memorialDate || "",
          familyEmail: hero.familyContactEmail || "",
          familyName: hero.familyContactName || "",
          senderEmail: currentUser?.email || "joseph.wiseman@steel-hearts.org",
          senderName: currentUser?.name || "Joseph Wiseman",
          sfId: hero.sfId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDraftResult("drafted");
        setStatus("Scheduled");
        if (onUpdate) onUpdate(hero.sfId, { status: "Scheduled" });
      } else {
        setDraftResult(data.mock ? "offline" : "error");
      }
    } catch {
      setDraftResult("error");
    } finally {
      setDraftingEmail(false);
      setTimeout(() => setDraftResult(null), 4000);
    }
  }, [hero, years, currentUser, onUpdate]);

  const normStatus = normalizeStatus(status);

  return (
    <tr
      style={{
        background: saving
          ? "rgba(212, 175, 55, 0.04)"
          : lastSaved === "saved"
          ? "rgba(34, 197, 94, 0.04)"
          : lastSaved === "error"
          ? "rgba(239, 68, 68, 0.04)"
          : "transparent",
        transition: "background 0.3s ease",
      }}
    >
      {/* Day */}
      <td
        style={{
          fontWeight: isToday ? 700 : 400,
          color: isToday ? "var(--gold)" : isPast ? "var(--text-dim)" : "var(--text)",
          whiteSpace: "nowrap",
        }}
      >
        {monthName.slice(0, 3)} {day}
        {isToday && (
          <span style={{ fontSize: 10, marginLeft: 6, color: "var(--gold)", fontWeight: 600 }}>
            TODAY
          </span>
        )}
      </td>

      {/* Hero Name */}
      <td>
        <span
          style={{
            color: isPast && normStatus !== "not_started" ? "var(--text-dim)" : "var(--text-bright)",
            fontWeight: 500,
          }}
        >
          {hero.fullName.replace(/\s*\(.*?\)\s*/, "")}
        </span>
      </td>

      {/* Branch */}
      <td>{hero.serviceCode}</td>

      {/* Years */}
      <td>{years}</td>

      {/* Assigned To — Dropdown */}
      <td>
        <select
          value={assignedTo}
          onChange={handleAssignChange}
          style={{
            background: "var(--bg)",
            color: assignedTo ? "var(--text-bright)" : "var(--text-dim)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-sm)",
            padding: "3px 6px",
            fontSize: 11,
            cursor: "pointer",
            maxWidth: 130,
          }}
        >
          <option value="">Unassigned</option>
          {volunteers.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </td>

      {/* Status — Editable dropdown */}
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select
            value={statusLabel(status)}
            onChange={handleStatusChange}
            style={{
              background: "var(--bg)",
              color:
                normStatus === "sent" ? "var(--status-green)" :
                normStatus === "scheduled" ? "var(--status-blue)" :
                "var(--status-orange)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 6px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {saving && (
            <span style={{ fontSize: 10, color: "var(--gold)" }}>saving...</span>
          )}
          {lastSaved === "saved" && (
            <span style={{ fontSize: 10, color: "var(--status-green)" }}>saved</span>
          )}
        </div>
      </td>

      {/* Notes — Inline Edit */}
      <td>
        {editingNotes ? (
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNotesSave();
                if (e.key === "Escape") setEditingNotes(false);
              }}
              autoFocus
              style={{
                background: "var(--bg)",
                color: "var(--text-bright)",
                border: "1px solid var(--gold)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 6px",
                fontSize: 11,
                flex: 1,
                minWidth: 120,
              }}
            />
            <button
              onClick={handleNotesSave}
              style={{
                background: "var(--gold)",
                color: "#000",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <span
            onClick={() => setEditingNotes(true)}
            style={{
              fontSize: 11,
              color: notes ? "var(--text)" : "var(--text-dim)",
              cursor: "pointer",
              borderBottom: "1px dashed var(--card-border)",
              paddingBottom: 1,
            }}
            title="Click to edit notes"
          >
            {notes || "add note"}
          </span>
        )}
      </td>

      {/* Contact Info + Draft Email */}
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {!hero.familyContactId ? (
            <span
              style={{
                fontSize: 10,
                color: "var(--status-orange)",
                fontWeight: 600,
                padding: "3px 8px",
                background: "rgba(245, 158, 11, 0.1)",
                borderRadius: "var(--radius-sm)",
                whiteSpace: "nowrap",
              }}
              title="No family contact on file"
            >
              Research Needed
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-dim)" }} title={hero.familyContactEmail || ""}>
              {hero.familyContactName || "On file"}
            </span>
          )}
          {hero.familyContactEmail && normStatus !== "sent" && (
            <button
              onClick={handleDraftEmail}
              disabled={draftingEmail || draftResult === "drafted"}
              title={`Draft anniversary email to ${hero.familyContactEmail}`}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--gold)",
                background: draftResult === "drafted" ? "rgba(34,197,94,0.15)" : "rgba(196,162,55,0.08)",
                color: draftResult === "drafted" ? "var(--status-green)" : draftResult === "error" ? "var(--status-red)" : "var(--gold)",
                cursor: draftingEmail ? "wait" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {draftingEmail ? "Drafting…" : draftResult === "drafted" ? "✓ Drafted" : draftResult === "error" ? "Error" : draftResult === "offline" ? "Offline" : "Draft Email"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AnniversaryTracker({
  heroes,
  monthName,
  isCurrentMonth,
  volunteers,
  today,
  currentUser,
}) {
  const [heroData, setHeroData] = useState(heroes);

  // Sync heroData when heroes prop changes (e.g. month switch)
  useEffect(() => {
    setHeroData(heroes);
  }, [heroes]);

  // Track updates for local state (optimistic UI)
  const handleUpdate = useCallback((sfId, fields) => {
    setHeroData((prev) =>
      prev.map((h) => {
        if (h.sfId !== sfId) return h;
        const updated = { ...h };
        if (fields.status !== undefined) updated.anniversaryStatus = fields.status;
        if (fields.assignedToName !== undefined) updated.anniversaryAssignedTo = fields.assignedToName;
        if (fields.notes !== undefined) updated.anniversaryNotes = fields.notes;
        return updated;
      })
    );
  }, []);

  if (heroData.length === 0) {
    return (
      <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
        No heroes match the current filters.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Workflow note */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 0" }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Assign volunteers here. Drafts, sending, and status updates happen in Slack.
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Hero</th>
            <th>Branch</th>
            <th>Years</th>
            <th>Assigned To</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Family Contact</th>
          </tr>
        </thead>
        <tbody>
          {heroData.map((hero) => {
            const day = hero.anniversaryDay || hero.dayOfMonth;
            const isPast = isCurrentMonth && day < today;
            const isToday = isCurrentMonth && day === today;

            return (
              <HeroRow
                key={hero.sfId}
                hero={hero}
                day={day}
                years={hero.years}
                isPast={isPast}
                isToday={isToday}
                monthName={monthName}
                volunteers={volunteers}
                onUpdate={handleUpdate}
                currentUser={currentUser}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

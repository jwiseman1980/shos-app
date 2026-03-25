"use client";

import { useState, useCallback, useEffect } from "react";
import StatusBadge from "@/components/StatusBadge";

const STATUS_OPTIONS = [
  { value: "Not Assigned", label: "Not Assigned", key: "not_assigned" },
  { value: "Assigned", label: "Assigned", key: "assigned" },
  { value: "In Progress", label: "In Progress", key: "in_progress" },
  { value: "Sent", label: "Sent", key: "sent" },
  { value: "Complete", label: "Complete", key: "complete" },
  { value: "Research", label: "Research", key: "research" },
  { value: "Escalated", label: "Escalated", key: "escalated" },
  { value: "Skipped", label: "Skipped", key: "skipped" },
];

function normalizeStatus(status) {
  if (!status) return "not_assigned";
  return status.toLowerCase().replace(/\s+/g, "_");
}

function statusLabel(status) {
  const key = normalizeStatus(status);
  const labels = {
    not_assigned: "Not Assigned",
    not_started: "Not Assigned",
    assigned: "Assigned",
    in_progress: "In Progress",
    sent: "Sent",
    email_sent: "Sent",
    complete: "Complete",
    completed: "Complete",
    research: "Research",
    escalated: "Escalated",
    skipped: "Skipped",
    blocked: "Escalated",
  };
  return labels[key] || status || "Not Assigned";
}

function HeroRow({ hero, day, years, isPast, isToday, monthName, volunteers, onUpdate, senderIdentity }) {
  const [status, setStatus] = useState(hero.anniversaryStatus || "Not Started");
  const [assignedTo, setAssignedTo] = useState(hero.anniversaryAssignedTo || "");
  const [notes, setNotes] = useState(hero.anniversaryNotes || "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [draftState, setDraftState] = useState(null); // null | "creating" | "created" | "error" | "no_family"

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

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    save({ status: newStatus, heroName: hero.fullName.replace(/\s*\(.*?\)\s*/, "") });
  };

  const handleAssignChange = (e) => {
    const newAssign = e.target.value;
    setAssignedTo(newAssign);
    save({ assignedToName: newAssign || null });
  };

  const handleNotesSave = () => {
    setEditingNotes(false);
    save({ notes });
  };

  const handleCreateDraft = async () => {
    if (!senderIdentity) return;
    if (!hero.familyContactId) {
      setDraftState("no_family");
      setTimeout(() => setDraftState(null), 3000);
      return;
    }
    setDraftState("creating");
    try {
      const res = await fetch("/api/anniversaries/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroName: hero.fullName.replace(/\s*\(.*?\)\s*/, ""),
          branch: hero.serviceCode,
          years: hero.years,
          memorialDate: hero.memorialDate,
          familyEmail: hero.familyContactEmail,
          familyName: hero.familyContactName,
          senderEmail: senderIdentity.email,
          senderName: senderIdentity.name,
          sfId: hero.sfId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDraftState("created");
        // Auto-update status to "In Progress"
        setStatus("In Progress");
        save({ status: "In Progress", heroName: hero.fullName.replace(/\s*\(.*?\)\s*/, "") });
      } else {
        setDraftState("error");
      }
    } catch {
      setDraftState("error");
    }
    setTimeout(() => setDraftState(null), 4000);
  };

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

      {/* Status — Dropdown */}
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select
            value={statusLabel(status)}
            onChange={handleStatusChange}
            style={{
              background: "var(--bg)",
              color: "var(--text-bright)",
              border: "1px solid var(--card-border)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 6px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {saving && (
            <span style={{ fontSize: 10, color: "var(--gold)" }}>saving...</span>
          )}
          {lastSaved === "saved" && (
            <span style={{ fontSize: 10, color: "var(--status-green)" }}>saved</span>
          )}
          {lastSaved === "offline" && (
            <span style={{ fontSize: 10, color: "var(--status-orange)" }}>offline</span>
          )}
          {lastSaved === "error" && (
            <span style={{ fontSize: 10, color: "var(--status-red)" }}>failed</span>
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

      {/* Draft Email */}
      <td>
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
            title="No family contact — research task for Joseph"
          >
            Research Needed
          </span>
        ) : draftState === "creating" ? (
          <span style={{ fontSize: 10, color: "var(--gold)" }}>creating...</span>
        ) : draftState === "created" ? (
          <span style={{ fontSize: 10, color: "var(--status-green)" }}>draft created</span>
        ) : draftState === "error" ? (
          <span style={{ fontSize: 10, color: "var(--status-red)" }}>failed</span>
        ) : (
          <button
            onClick={handleCreateDraft}
            disabled={!senderIdentity}
            style={{
              background: senderIdentity ? "var(--gold)" : "var(--card-border)",
              color: senderIdentity ? "#000" : "var(--text-dim)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 600,
              cursor: senderIdentity ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
            }}
            title={senderIdentity ? `Create draft in ${senderIdentity.email}` : "Not logged in"}
          >
            Create Draft
          </button>
        )}
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

  // Derive sender identity from the logged-in user
  const senderIdentity = currentUser?.email
    ? { email: currentUser.email, name: currentUser.name || currentUser.email.split("@")[0] }
    : null;

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
      {/* Logged-in user indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 0" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Sending as:
        </span>
        {senderIdentity ? (
          <span style={{ fontSize: 12, color: "var(--status-green)" }}>
            {senderIdentity.name} ({senderIdentity.email})
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--status-red)" }}>
            Not logged in
          </span>
        )}
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
            <th>Email</th>
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
                senderIdentity={senderIdentity}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

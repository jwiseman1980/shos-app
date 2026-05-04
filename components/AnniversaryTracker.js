"use client";

import { useState, useCallback, useEffect } from "react";
import StatusBadge from "@/components/StatusBadge";
import { isFamilyRelationship } from "@/lib/relationships";

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

/**
 * Shared row hook — keeps state and persistence identical between
 * the desktop table row and the mobile card.
 */
function useHeroRowState(hero, onUpdate, currentUser, years) {
  const [status, setStatus] = useState(hero.anniversaryStatus || "Not Started");
  const [assignedTo, setAssignedTo] = useState(hero.anniversaryAssignedTo || "");
  const [notes, setNotes] = useState(hero.anniversaryNotes || "");
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

  const handleAssignChange = (val) => {
    setAssignedTo(val);
    save({ assignedToName: val || null });
  };

  const handleStatusChange = (val) => {
    setStatus(val);
    save({ status: val });
  };

  const handleNotesSave = (val) => {
    setNotes(val);
    save({ notes: val });
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

  return {
    status, assignedTo, notes, saving, lastSaved, draftingEmail, draftResult,
    handleAssignChange, handleStatusChange, handleNotesSave, handleDraftEmail,
  };
}

function HeroRow({ hero, day, years, isPast, isToday, monthName, volunteers, onUpdate, currentUser, viewMode, daysUntil, anniversaryMonthName }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftLocalNotes, setDraftLocalNotes] = useState(hero.anniversaryNotes || "");
  const {
    status, assignedTo, notes, saving, lastSaved, draftingEmail, draftResult,
    handleAssignChange, handleStatusChange, handleNotesSave, handleDraftEmail,
  } = useHeroRowState(hero, onUpdate, currentUser, years);

  // Keep local notes-edit buffer in sync with persisted notes
  useEffect(() => { setDraftLocalNotes(notes); }, [notes]);

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
        {viewMode === "upcoming"
          ? `${(anniversaryMonthName || monthName).slice(0, 3)} ${day}`
          : `${monthName.slice(0, 3)} ${day}`}
        {viewMode === "upcoming" && daysUntil != null && (
          <span
            style={{
              fontSize: 10,
              marginLeft: 6,
              fontWeight: 600,
              color:
                daysUntil === 0
                  ? "var(--gold)"
                  : daysUntil <= 7
                  ? "var(--status-red)"
                  : daysUntil <= 14
                  ? "var(--status-orange)"
                  : "var(--text-dim)",
            }}
          >
            {daysUntil === 0
              ? "TODAY"
              : daysUntil === 1
              ? "tomorrow"
              : `${daysUntil}d`}
          </span>
        )}
        {viewMode !== "upcoming" && isToday && (
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
          onChange={(e) => handleAssignChange(e.target.value)}
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
            onChange={(e) => handleStatusChange(e.target.value)}
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
              value={draftLocalNotes}
              onChange={(e) => setDraftLocalNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setEditingNotes(false);
                  handleNotesSave(draftLocalNotes);
                }
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
              onClick={() => { setEditingNotes(false); handleNotesSave(draftLocalNotes); }}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }} title={hero.familyContactEmail || ""}>
                {hero.familyContactName || "On file"}
              </span>
              {hero.familyContactRelationship?.length > 0 && (
                <span style={{ fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>
                  {hero.familyContactRelationship.join(", ")}
                </span>
              )}
            </div>
          )}
          {hero.familyContactEmail && normStatus !== "sent" && (
            isFamilyRelationship(hero.familyContactRelationship) ? (
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
            ) : (
              <span
                title="Linked contact is not Surviving/Extended Family — repoint family_contact_id before drafting"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "var(--status-orange)",
                  whiteSpace: "nowrap",
                }}
              >
                Wrong contact
              </span>
            )
          )}
        </div>
      </td>
    </tr>
  );
}

function HeroCard({ hero, day, years, monthName, anniversaryMonthName, daysUntil, viewMode, volunteers, onUpdate, currentUser }) {
  const {
    status, assignedTo, notes, saving, lastSaved, draftingEmail, draftResult,
    handleAssignChange, handleStatusChange, handleNotesSave, handleDraftEmail,
  } = useHeroRowState(hero, onUpdate, currentUser, years);

  const normStatus = normalizeStatus(status);
  const dateLabel = `${(anniversaryMonthName || monthName).slice(0, 3)} ${day}`;
  const daysLabel = daysUntil == null ? null
    : daysUntil === 0 ? "TODAY"
    : daysUntil === 1 ? "Tomorrow"
    : `${daysUntil} days away`;
  const daysColor = daysUntil === 0 ? "var(--gold)"
    : daysUntil <= 7 ? "var(--status-red)"
    : daysUntil <= 14 ? "var(--status-orange)"
    : "var(--text-dim)";

  return (
    <div className="anniv-card">
      <div className="anniv-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="anniv-card-title">
            {(hero.fullName || hero.name || "").replace(/\s*\(.*?\)\s*/, "")}
          </div>
          <div className="anniv-card-meta">
            {[hero.serviceCode, years != null ? `${years} yrs` : null, hero.sku].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="anniv-card-date">
          {dateLabel}
          {viewMode === "upcoming" && daysLabel && (
            <span className="anniv-card-days" style={{ color: daysColor }}>
              {daysLabel}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className={`anniv-card-status-pill anniv-status-${normStatus}`}>
          {statusLabel(status)}
        </span>
        {hero.familyContactId ? (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Contact: {hero.familyContactName || "on file"}
            {hero.familyContactRelationship?.length > 0 && (
              <span style={{ fontStyle: "italic", marginLeft: 4 }}>
                ({hero.familyContactRelationship.join(", ")})
              </span>
            )}
          </span>
        ) : (
          <span className="anniv-card-status-pill" style={{ background: "rgba(245, 158, 11, 0.12)", color: "var(--status-orange)" }}>
            Research needed
          </span>
        )}
        {saving && <span style={{ fontSize: 10, color: "var(--gold)" }}>saving…</span>}
        {lastSaved === "saved" && <span style={{ fontSize: 10, color: "var(--status-green)" }}>saved</span>}
      </div>

      <div className="anniv-card-row">
        <span className="anniv-card-label">Assign to</span>
        <select
          className="anniv-card-select"
          value={assignedTo}
          onChange={(e) => handleAssignChange(e.target.value)}
        >
          <option value="">Unassigned</option>
          {volunteers.map((v) => (
            <option key={v.name} value={v.name}>{v.name}</option>
          ))}
        </select>
      </div>

      <div className="anniv-card-row">
        <span className="anniv-card-label">Status</span>
        <select
          className="anniv-card-select"
          value={statusLabel(status)}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {hero.familyContactEmail && normStatus !== "sent" && (
        isFamilyRelationship(hero.familyContactRelationship) ? (
          <div className="anniv-card-actions">
            <button
              className="anniv-card-btn"
              onClick={handleDraftEmail}
              disabled={draftingEmail || draftResult === "drafted"}
            >
              {draftingEmail ? "Drafting…"
                : draftResult === "drafted" ? "✓ Drafted"
                : draftResult === "error" ? "Error — retry"
                : "Draft email"}
            </button>
          </div>
        ) : (
          <div className="anniv-card-actions">
            <span
              title="Linked contact is not Surviving/Extended Family — repoint family_contact_id before drafting"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(245, 158, 11, 0.12)",
                color: "var(--status-orange)",
              }}
            >
              Wrong contact — needs research
            </span>
          </div>
        )
      )}
    </div>
  );
}

export default function AnniversaryTracker({
  heroes,
  monthName,
  isCurrentMonth,
  volunteers,
  today,
  currentUser,
  viewMode = "month",
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
    <div>
      {/* Workflow note */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 0" }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Assign volunteers here. Drafts, sending, and status updates happen in Slack.
        </span>
      </div>

      {/* Mobile: card list */}
      <div className="anniv-card-list">
        {heroData.map((hero) => {
          const day = hero.anniversaryDay || hero.dayOfMonth;
          return (
            <HeroCard
              key={`card-${hero.sfId}`}
              hero={hero}
              day={day}
              years={hero.years}
              monthName={monthName}
              anniversaryMonthName={hero.anniversaryMonthName}
              daysUntil={hero.daysUntil}
              viewMode={viewMode}
              volunteers={volunteers}
              onUpdate={handleUpdate}
              currentUser={currentUser}
            />
          );
        })}
      </div>

      {/* Desktop: data table */}
      <div className="anniv-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{viewMode === "upcoming" ? "Date" : "Day"}</th>
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
            const isPast = viewMode === "upcoming" ? false : isCurrentMonth && day < today;
            const isToday = viewMode === "upcoming"
              ? hero.daysUntil === 0
              : isCurrentMonth && day === today;

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
                viewMode={viewMode}
                daysUntil={hero.daysUntil}
                anniversaryMonthName={hero.anniversaryMonthName}
              />
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
